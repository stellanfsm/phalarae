import { SignJWT, jwtVerify } from "jose";

const COOKIE = "phalerae_admin";

function secretKey(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_JWT_SECRET must be set (min 16 chars) for admin auth");
  }
  return new TextEncoder().encode(s);
}

export type AdminJwtPayload = {
  sub: string;
  email: string;
  /** undefined on legacy tokens issued before Phase 1 */
  firmId?: string | null;
  /** undefined on legacy tokens issued before Phase 1 */
  role?: string;
  /** undefined on legacy tokens issued before Phase 1 */
  sessionId?: string;
};

export type AdminTokenInput = {
  sub: string;
  email: string;
  firmId: string | null;
  role: string;
  sessionId: string;
};

export async function signAdminToken(payload: AdminTokenInput, maxAgeSec: number): Promise<string> {
  return new SignJWT({
    email: payload.email,
    firmId: payload.firmId,
    role: payload.role,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(secretKey());
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!sub || !email) return null;
    // firmId: null is a valid value (operator); undefined means claim absent (legacy token)
    const firmId: string | null | undefined =
      payload.firmId === null
        ? null
        : typeof payload.firmId === "string"
          ? payload.firmId
          : undefined;
    const role = typeof payload.role === "string" ? payload.role : undefined;
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : undefined;
    return { sub, email, firmId, role, sessionId };
  } catch {
    return null;
  }
}

export const ADMIN_COOKIE_NAME = COOKIE;

export function adminCookieOptions(maxAgeSec: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  };
}
