"use server";

import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/admin-context";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changePasswordAction(formData: FormData): Promise<ChangePasswordResult> {
  const ctx = await getAdminContext();
  if (!ctx) return { ok: false, error: "Unauthorized" };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: ctx.sub },
    select: { passwordHash: true },
  });
  if (!user) return { ok: false, error: "User not found" };

  const currentOk = await compare(parsed.data.currentPassword, user.passwordHash);
  if (!currentOk) return { ok: false, error: "Current password is incorrect" };

  const newHash = await hash(parsed.data.newPassword, 10);
  await prisma.adminUser.update({
    where: { id: ctx.sub },
    data: { passwordHash: newHash },
  });

  await prisma.adminSession.updateMany({
    where: { userId: ctx.sub, id: { not: ctx.sessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { ok: true };
}
