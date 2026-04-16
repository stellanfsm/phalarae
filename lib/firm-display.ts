import type { Firm } from "@/app/generated/prisma/client";
import { formatDisclaimerBlock } from "@/lib/disclaimer";

/** Stored in `Firm.branding` JSON — no migration required. */
export type FirmBrandingJson = {
  displayName?: string;
  primaryColor?: string;
  logoUrl?: string;
  urgentPhoneDisplay?: string;
  urgentPhoneTel?: string;
  /** Shown after “Thank you for contacting {firm}.” before standard disclaimers. */
  greetingMessage?: string;
  /** Optional override for lead alerts when `Firm.notificationEmail` is empty. */
  contactEmail?: string;
};

export type ResolvedFirmDisplay = {
  firmName: string;
  primaryColor: string;
  logoUrl: string;
  disclaimerText: string;
  urgentPhoneDisplay: string;
  urgentPhoneTel: string;
  /** Custom intro paragraph; null = use default block only. */
  greetingMessage: string | null;
};

export function parseFirmBranding(json: unknown): FirmBrandingJson {
  if (!json || typeof json !== "object") return {};
  const o = json as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : undefined);
  return {
    displayName: s("displayName"),
    primaryColor: s("primaryColor"),
    logoUrl: s("logoUrl"),
    urgentPhoneDisplay: s("urgentPhoneDisplay"),
    urgentPhoneTel: s("urgentPhoneTel"),
    greetingMessage: s("greetingMessage"),
    contactEmail: s("contactEmail"),
  };
}

/**
 * Resolves display values from DB `branding` JSON + `disclaimerOverride`.
 *
 * Firm.name is the primary label; optional branding.displayName overrides only when set and
 * different (see admin save logic clearing stale displayName when the main name changes).
 */
export function resolveFirmDisplay(firm: Firm): ResolvedFirmDisplay {
  const b = parseFirmBranding(firm.branding);

  const firmName =
    b.displayName?.trim() ||
    firm.name?.trim() ||
    "Firm";
  const primaryColor = b.primaryColor?.trim() || "#1e3a5f";
  const logoUrl = (b.logoUrl?.trim() || "").trim();
  const urgentPhoneDisplay = b.urgentPhoneDisplay?.trim() || "";
  const urgentPhoneTel = b.urgentPhoneTel?.trim() || "";
  const disclaimerText = formatDisclaimerBlock(firm.disclaimerOverride);
  const greetingMessage = b.greetingMessage?.trim() || null;

  return {
    firmName,
    primaryColor,
    logoUrl,
    disclaimerText,
    urgentPhoneDisplay,
    urgentPhoneTel,
    greetingMessage,
  };
}

/** Lead alert recipient: branding.contactEmail, then Firm.notificationEmail. */
export function resolveLeadAlertEmail(firm: Firm): string | null {
  const b = parseFirmBranding(firm.branding);
  const fromBranding = b.contactEmail?.trim();
  const fromRow = firm.notificationEmail?.trim();
  return fromBranding || fromRow || null;
}
