"use server";

import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAdminToken, ADMIN_COOKIE_NAME, adminCookieOptions } from "@/lib/admin-token";

function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const MAX_AGE_SEC = 60 * 60 * 12;

const schema = z
  .object({
    token: z.string().min(64).max(64),
    name: z.string().max(100).optional(),
    password: z.string().min(10, "Password must be at least 10 characters").max(200),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function acceptInviteAction(
  formData: FormData,
): Promise<{ error: string }> {
  const rawName = String(formData.get("name") ?? "").trim();
  const parsed = schema.safeParse({
    token: String(formData.get("token") ?? ""),
    name: rawName || undefined,
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { token, name, password } = parsed.data;

  const invite = await prisma.adminInvite.findUnique({
    where: { token: hashInviteToken(token) },
    select: { id: true, firmId: true, email: true, role: true, usedAt: true, expiresAt: true },
  });
  if (!invite || invite.usedAt !== null || invite.expiresAt < new Date()) {
    return { error: "This invite is invalid or has expired." };
  }

  const passwordHash = await hash(password, 12);
  const now = new Date();

  let userId: string;
  let sessionId: string;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const marked = await tx.adminInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: now },
      });
      if (marked.count === 0) throw new Error("ALREADY_USED");

      const existingUser = await tx.adminUser.findUnique({
        where: { email: invite.email },
        select: { id: true, firmId: true, name: true },
      });

      let targetUserId: string;
      if (existingUser) {
        if (existingUser.firmId !== invite.firmId) throw new Error("EMAIL_FIRM_MISMATCH");
        await tx.adminUser.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            deactivatedAt: null,
            role: invite.role,
            name: name ?? existingUser.name,
            lastLoginAt: now,
          },
        });
        await tx.adminSession.updateMany({
          where: { userId: existingUser.id, revokedAt: null },
          data: { revokedAt: now },
        });
        targetUserId = existingUser.id;
      } else {
        const newUser = await tx.adminUser.create({
          data: {
            email: invite.email,
            passwordHash,
            role: invite.role,
            name: name ?? null,
            firmId: invite.firmId,
            lastLoginAt: now,
          },
        });
        targetUserId = newUser.id;
      }

      const session = await tx.adminSession.create({
        data: {
          userId: targetUserId,
          expiresAt: new Date(now.getTime() + MAX_AGE_SEC * 1000),
        },
        select: { id: true },
      });

      return { userId: targetUserId, sessionId: session.id };
    });

    userId = result.userId;
    sessionId = result.sessionId;
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "ALREADY_USED") return { error: "This invite has already been used." };
      if (e.message === "EMAIL_FIRM_MISMATCH")
        return { error: "This email is registered with a different firm." };
    }
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { email: true, firmId: true, role: true },
  });
  if (!user) return { error: "Account setup error. Please contact support." };

  const jwtToken = await signAdminToken(
    { sub: userId, email: user.email, firmId: user.firmId, role: user.role, sessionId },
    MAX_AGE_SEC,
  );

  const jar = await cookies();
  jar.set(ADMIN_COOKIE_NAME, jwtToken, adminCookieOptions(MAX_AGE_SEC));

  redirect("/admin/leads");
}
