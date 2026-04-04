"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertFirmAccess } from "@/lib/admin-operator";
import { parseFirmBranding, type FirmBrandingJson } from "@/lib/firm-display";

export async function updateFirmSettingsAction(firmId: string, formData: FormData) {
  await assertFirmAccess(firmId);

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
