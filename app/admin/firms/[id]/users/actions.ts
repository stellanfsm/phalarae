"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/admin-context";
import { sendInviteEmail } from "@/lib/email";

function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

const inviteSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(["firm_admin", "firm_staff"]),
});

export type InviteActionResult =
  | { ok: true; emailSent: boolean; inviteUrl: string }
  | { ok: false; error: string };

export async function sendInviteAction(
  firmId: string,
  formData: FormData,
): Promise<InviteActionResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Unauthorized" };
  if (ctx.role === "firm_staff") return { ok: false, error: "Forbidden" };
  if (ctx.role !== "operator" && ctx.firmId !== firmId) return { ok: false, error: "Forbidden" };

  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, role } = parsed.data;

  let existingUser: { firmId: string | null; deactivatedAt: Date | null } | null;
  try {
    existingUser = await prisma.adminUser.findUnique({
      where: { email },
      select: { firmId: true, deactivatedAt: true },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Service error. Please try again." };
  }

  if (existingUser) {
    if (existingUser.firmId !== firmId) {
      return { ok: false, error: "This email is registered with a different firm." };
    }
    if (!existingUser.deactivatedAt) {
      return { ok: false, error: "A user with this email is already active for this firm." };
    }
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  try {
    await prisma.adminInvite.updateMany({
      where: { firmId, email, usedAt: null },
      data: { expiresAt: new Date() },
    });
    await prisma.adminInvite.create({
      data: { firmId, email, role, token: hashInviteToken(token), expiresAt, createdById: ctx.sub },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not save invite. Please try again." };
  }

  const hdrs = await headers();
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = hdrs.get("host") ?? "localhost:3000";
  const inviteUrl = `${proto}://${host}/admin/invite/${token}`;

  let firmName = "the firm";
  try {
    const firm = await prisma.firm.findUnique({ where: { id: firmId }, select: { name: true } });
    firmName = firm?.name ?? "the firm";
  } catch {
    // non-critical — invite URL already built, email sends with fallback name
  }

  const emailResult = await sendInviteEmail({
    to: email,
    firmName,
    role,
    inviteUrl,
    inviterEmail: ctx.email,
  });

  revalidatePath(`/admin/firms/${firmId}/users`);
  return { ok: true, emailSent: emailResult.sent, inviteUrl };
}

export async function deactivateUserAction(
  firmId: string,
  userId: string,
): Promise<void> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "firm_staff") throw new Error("Forbidden");
  if (ctx.role !== "operator" && ctx.firmId !== firmId) throw new Error("Forbidden");

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { firmId: true, role: true, deactivatedAt: true },
  });
  if (!user || user.firmId !== firmId) throw new Error("User not found");
  if (user.deactivatedAt) throw new Error("User is already deactivated");

  if (user.role === "firm_admin") {
    const remaining = await prisma.adminUser.count({
      where: { firmId, role: "firm_admin", deactivatedAt: null, id: { not: userId } },
    });
    if (remaining === 0) {
      throw new Error("Cannot deactivate the last active firm admin for this firm.");
    }
  }

  const deactivatedAt = new Date();
  await prisma.adminUser.update({
    where: { id: userId },
    data: { deactivatedAt },
  });
  await prisma.adminSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: deactivatedAt },
  });
  revalidatePath(`/admin/firms/${firmId}/users`);
}

export async function reactivateUserAction(
  firmId: string,
  userId: string,
): Promise<void> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "firm_staff") throw new Error("Forbidden");
  if (ctx.role !== "operator" && ctx.firmId !== firmId) throw new Error("Forbidden");

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { firmId: true, deactivatedAt: true },
  });
  if (!user || user.firmId !== firmId) throw new Error("User not found");
  if (!user.deactivatedAt) throw new Error("User is not deactivated");

  await prisma.adminUser.update({
    where: { id: userId },
    data: { deactivatedAt: null },
  });
  revalidatePath(`/admin/firms/${firmId}/users`);
}
