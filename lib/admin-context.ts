/**
 * Canonical way to get a trusted admin identity in Server Components,
 * Server Actions, and Route Handlers.
 *
 * Reads firmId, role, and sessionId directly from JWT claims (no AdminUser DB lookup).
 * Validates the referenced AdminSession row for revocation and expiry (one DB call).
 * Returns null for legacy tokens (pre-Phase 1) that lack the new claims,
 * which forces a re-login and issues an enriched token.
 */

import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-token";
import { prisma } from "@/lib/prisma";

export type AdminContext = {
  /** AdminUser.id */
  sub: string;
  email: string;
  /** null = platform operator; string = scoped to that firm */
  firmId: string | null;
  role: "operator" | "firm_admin" | "firm_staff";
  sessionId: string;
};

const VALID_ROLES = ["operator", "firm_admin", "firm_staff"] as const;

function coerceRole(raw: string | undefined): AdminContext["role"] {
  if (raw && (VALID_ROLES as readonly string[]).includes(raw)) {
    return raw as AdminContext["role"];
  }
  return "firm_admin";
}

/**
 * Returns the authenticated admin context, or null if the session is absent,
 * invalid, expired, or revoked.
 *
 * Caller is responsible for redirecting on null:
 *   const ctx = await getAdminContext();
 *   if (!ctx) redirect("/admin/login");
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyAdminToken(token);
  if (!payload) return null;

  // Legacy tokens (pre-Phase 1) lack sessionId, firmId, and role.
  // Return null so the caller redirects to login, which issues a full enriched token.
  if (!payload.sessionId || payload.firmId === undefined || !payload.role) {
    return null;
  }

  // Validate the session row: must exist, not revoked, and not expired.
  let session: { revokedAt: Date | null; expiresAt: Date } | null;
  try {
    session = await prisma.adminSession.findUnique({
      where: { id: payload.sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
  } catch {
    return null;
  }

  if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
    return null;
  }

  return {
    sub: payload.sub,
    email: payload.email,
    firmId: payload.firmId,
    role: coerceRole(payload.role),
    sessionId: payload.sessionId,
  };
}

/**
 * Asserts that the given context has access to a firm-scoped resource.
 * Operators (firmId === null) can access any firm.
 * Firm users can only access their own firm.
 *
 * Calls notFound() on violation — consistent with page-level resource guarding.
 */
export function requireFirmAccess(ctx: AdminContext, resourceFirmId: string): void {
  if (ctx.role !== "operator" && ctx.firmId !== resourceFirmId) {
    notFound();
  }
}
