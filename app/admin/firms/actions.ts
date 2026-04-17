"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/admin-context";
import { parseFirmBranding, type FirmBrandingJson } from "@/lib/firm-display";

const VALID_STATUSES = ["pending", "active", "inactive"] as const;

const createFirmSchema = z.object({
  name: z.string().min(1, "Firm name is required").max(200),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(80, "Slug must be 80 characters or fewer")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  notificationEmail: z.string().email("Invalid email").max(255).or(z.literal("")),
});

export async function updateFirmSettingsAction(firmId: string, formData: FormData) {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role === "firm_staff") throw new Error("Forbidden");
  if (ctx.role !== "operator" && ctx.firmId !== firmId) throw new Error("Forbidden");

  const existing = await prisma.firm.findUnique({ where: { id: firmId } });
  if (!existing) throw new Error("Firm not found");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1) throw new Error("Firm name is required");

  const notificationEmail = String(formData.get("notificationEmail") ?? "").trim();
  const disclaimerOverride = String(formData.get("disclaimerOverride") ?? "").trim();

  const fields: (keyof FirmBrandingJson)[] = [
    "displayName",
    "primaryColor",
    "logoUrl",
    "urgentPhoneDisplay",
    "urgentPhoneTel",
    "greetingMessage",
    "contactEmail",
  ];
  const prev = parseFirmBranding(existing.branding);
  const next: FirmBrandingJson = { ...prev };
  for (const key of fields) {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw) next[key] = raw;
    else delete next[key];
  }

  // Keep optional public name only when it meaningfully differs from the main name.
  if (next.displayName?.trim() === name) {
    delete next.displayName;
  }
  // If they renamed the firm, drop a stale branding.displayName that still matches the OLD name
  // (form default), so the new Firm.name shows on intake. Real overrides differ from both.
  if (existing.name.trim() !== name.trim()) {
    const dn = next.displayName?.trim();
    if (!dn || dn === name || dn === existing.name.trim()) {
      delete next.displayName;
    }
  }

  const brandingJson: Prisma.InputJsonValue | typeof Prisma.DbNull =
    Object.keys(next).length > 0 ? (next as Record<string, string>) : Prisma.DbNull;

  await prisma.firm.update({
    where: { id: firmId },
    data: {
      name,
      notificationEmail: notificationEmail || null,
      disclaimerOverride: disclaimerOverride || null,
      branding: brandingJson,
    },
  });

  revalidatePath("/admin/firms");
  revalidatePath(`/admin/firms/${firmId}`);
  revalidatePath(`/intake/${existing.slug}`);
  revalidatePath("/embed");
}

export async function createFirmAction(
  formData: FormData,
): Promise<{ error: string }> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "operator") throw new Error("Forbidden");

  const parsed = createFirmSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim(),
    notificationEmail: String(formData.get("notificationEmail") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, slug, notificationEmail } = parsed.data;

  const existing = await prisma.firm.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return { error: `A firm with slug \"${slug}\" already exists.` };

  const firm = await prisma.firm.create({
    data: { name, slug, notificationEmail: notificationEmail || null },
    select: { id: true },
  });

  revalidatePath("/admin/firms");
  redirect(`/admin/firms/${firm.id}`);
}

export async function setFirmStatusAction(
  firmId: string,
  status: string,
): Promise<void> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Unauthorized");
  if (ctx.role !== "operator") throw new Error("Forbidden");
  if (!(VALID_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");

  await prisma.firm.update({
    where: { id: firmId },
    data: { status },
  });

  revalidatePath("/admin/firms");
  revalidatePath(`/admin/firms/${firmId}`);
}
