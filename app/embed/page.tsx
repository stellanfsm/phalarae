import { notFound } from "next/navigation";
import {
  defaultEmbedSlug,
  resolveEmbedFirmName,
  resolveEmbedLauncherLabel,
  resolveEmbedPrimaryColor,
} from "@/lib/embed-params";
import { IntakeEmbedWidget } from "@/components/intake/IntakeEmbedWidget";
import { IntakeWidget } from "@/components/intake/IntakeWidget";
import { prisma } from "@/lib/prisma";
import { resolveFirmDisplay } from "@/lib/firm-display";

export const dynamic = "force-dynamic";

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const slug = defaultEmbedSlug(firstParam(sp.slug));

  let firm;
  try {
    firm = await prisma.firm.findUnique({ where: { slug } });
  } catch (e) {
    console.error(e);
    throw new Error("Database connection failed. Check DATABASE_URL.");
  }
  if (!firm) notFound();

  const r = resolveFirmDisplay(firm);

  const firmDisplayName = resolveEmbedFirmName(firstParam(sp.firm), r.firmName);
  const primaryColor = resolveEmbedPrimaryColor(firstParam(sp.color), r.primaryColor);
  const launcherLabel = resolveEmbedLauncherLabel(firstParam(sp.label) ?? firstParam(sp.cta));

  /** Full chat in the iframe (good for a block in the page). Omit = floating launcher only. */
  const inline =
    firstParam(sp.inline) === "1" ||
    firstParam(sp.inline) === "true" ||
    firstParam(sp.mode) === "inline";

  if (inline) {
    return (
      <IntakeWidget
        firmSlug={firm.slug}
        firmDisplayName={firmDisplayName}
        primaryColor={primaryColor}
        disclaimerText={r.disclaimerText}
        logoUrl={r.logoUrl}
        urgentPhoneDisplay={r.urgentPhoneDisplay}
        urgentPhoneTel={r.urgentPhoneTel}
      />
    );
  }

  return (
    <IntakeEmbedWidget
      firmSlug={firm.slug}
      firmDisplayName={firmDisplayName}
      primaryColor={primaryColor}
      disclaimerText={r.disclaimerText}
      logoUrl={r.logoUrl}
      urgentPhoneDisplay={r.urgentPhoneDisplay}
      urgentPhoneTel={r.urgentPhoneTel}
      launcherLabel={launcherLabel}
    />
  );
}
