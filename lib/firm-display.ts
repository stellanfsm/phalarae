import type { Firm } from "@/app/generated/prisma/client";
import { formatDisclaimerBlock } from "@/lib/disclaimer";
import { getFirmConfigForSlug } from "@/config/firm";

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
 * Single merge point: `config/firm.ts` wins for matching slug; otherwise DB `branding` + `disclaimerOverride`.
 */
export function resolveFirmDisplay(firm: Firm): ResolvedFirmDisplay {
  const cfg = getFirmConfigForSlug(firm.slug);
  const b = parseFirmBranding(firm.branding);

  const firmName = cfg?.firmName ?? b.displayName?.trim() ?? firm.name;
  const primaryColor = cfg?.primaryColor ?? b.primaryColor?.trim() ?? "#1e3a5f";
  const logoUrl = (cfg?.logoUrl ?? b.logoUrl ?? "").trim();
  const urgentPhoneDisplay =
    cfg?.urgentPhoneDisplay ?? b.urgentPhoneDisplay?.trim() ?? "(555) 123-4567";
  const urgentPhoneTel = cfg?.urgentPhoneTel ?? b.urgentPhoneTel?.trim() ?? "+15551234567";
  const disclaimerText =
    cfg?.disclaimerText?.trim() ?? formatDisclaimerBlock(firm.disclaimerOverride);
  const greetingMessage =
    cfg?.greetingMessage?.trim() ?? b.greetingMessage?.trim() ?? null;

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

/** Lead alert recipient: code config first, then branding.contactEmail, then Firm.notificationEmail. */
export function resolveLeadAlertEmail(firm: Firm): string | null {
  const cfg = getFirmConfigForSlug(firm.slug);
  const b = parseFirmBranding(firm.branding);
  const fromCfg = cfg?.contactEmail?.trim();
  const fromBranding = b.contactEmail?.trim();
  const fromRow = firm.notificationEmail?.trim();
  return fromCfg || fromBranding || fromRow || null;
}
