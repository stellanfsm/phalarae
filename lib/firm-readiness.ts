import { parseFirmBranding } from "@/lib/firm-display";

/**
 * Minimal input shape — only the fields needed for readiness computation.
 * Intentionally does NOT call resolveLeadAlertEmail (requires full Firm type).
 * Email check priority: branding.contactEmail → Firm.notificationEmail.
 */
export type FirmForReadiness = {
  notificationEmail: string | null;
  branding: unknown;
};

export type ReadinessBlocker = "no_notification_email" | "no_active_firm_admin";

export type FirmReadiness = {
  ready: boolean;
  blockers: ReadinessBlocker[];
};

export const BLOCKER_LABELS: Record<ReadinessBlocker, { label: string; hint: string }> = {
  no_notification_email: {
    label: "Lead alert email configured",
    hint: "No lead alert email or branding override is set — completed intakes still create leads, but new-lead emails may not send (lead alert can show No recipient).",
  },
  no_active_firm_admin: {
    label: "At least one active firm admin",
    hint: "This firm has no active admin user who can log in to review leads.",
  },
};

export function computeFirmReadiness(
  firm: FirmForReadiness,
  activeFirmAdminCount: number,
): FirmReadiness {
  const b = parseFirmBranding(firm.branding);
  const hasEmail = !!(b.contactEmail?.trim() || firm.notificationEmail?.trim());
  const hasAdmin = activeFirmAdminCount > 0;

  const blockers: ReadinessBlocker[] = [];
  if (!hasEmail) blockers.push("no_notification_email");
  if (!hasAdmin) blockers.push("no_active_firm_admin");

  return { ready: blockers.length === 0, blockers };
}
