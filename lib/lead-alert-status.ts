/**
 * User-facing copy for `Lead.alertStatus` (set when intake completes and the lead alert is handled).
 * Keep aligned with `persistLeadAlertStatus` in `app/api/intake/route.ts` (recipient resolution + send outcome).
 */

const COPY = {
  sent: {
    tooltip:
      "Lead alert email was sent successfully when this intake completed (the mail provider accepted the send).",
    triageGuidance:
      "Lead alert email was sent when this intake completed. Inbox delivery can still depend on spam filters and the recipient’s mail system.",
    reliabilityCallout: null as string | null,
    filterChipTitle: "Show leads whose lead alert email was sent at completion",
  },
  failed: {
    tooltip:
      "The lead alert email was attempted but not accepted. Use the error text (if shown) and verify the firm’s lead alert settings.",
    triageGuidance:
      "Sending the lead alert email failed. Review the error detail below, confirm the firm’s lead alert email and optional branding override, then verify with the next completed intake.",
    reliabilityCallout: "The email provider did not accept this send—use the error line above for specifics.",
    filterChipTitle: "Show leads where sending the lead alert email failed",
  },
  no_recipient: {
    tooltip:
      "No recipient inbox was available when this completed. Set the lead alert email or the branding override (override is used first when set).",
    triageGuidance:
      "No destination inbox was available for the lead alert when this intake completed. Add the lead alert email in firm settings, or set branding Secondary alert email (optional) to override the primary.",
    reliabilityCallout: "No inbox was resolved for this lead alert—configure lead alert email or the branding override on the firm settings page.",
    filterChipTitle: "Show leads where no lead alert recipient was available at completion",
  },
} as const;

export type LeadAlertStatusKey = keyof typeof COPY;

export function leadAlertStatusTooltip(status: string): string | undefined {
  return status in COPY ? COPY[status as LeadAlertStatusKey].tooltip : undefined;
}

export function leadAlertTriageGuidance(status: string): string {
  const row = status in COPY ? COPY[status as LeadAlertStatusKey] : null;
  return row?.triageGuidance ?? "Lead alert status is recorded when an intake completes.";
}

export function leadAlertReliabilityCallout(status: string): string | null {
  const row = status in COPY ? COPY[status as LeadAlertStatusKey] : null;
  return row?.reliabilityCallout ?? null;
}

export function leadAlertFilterChipTitle(filter: LeadAlertStatusKey): string {
  return COPY[filter].filterChipTitle;
}

/** Short legend for the leads list lead-alert reliability block (matches Lead.alertStatus semantics). */
export const LEAD_ALERT_RELIABILITY_LEGEND =
  "No recipient: no inbox was resolved for the lead alert when the intake completed. Failed: the lead alert send was attempted but not accepted. Sent: the lead alert email was accepted by the mail provider at completion.";

/** Table column and cross-links use this label for consistency. */
export const LEAD_ALERT_COLUMN_LABEL = "Lead alert";

/** Helper under firm settings — matches `resolveLeadAlertEmail` (override first, then primary). */
export const FIRM_LEAD_ALERT_PRIMARY_HELP =
  "Primary inbox for lead alert email. If this and the optional override below are both empty, completed intakes cannot send a lead alert (leads may show No recipient).";

export const FIRM_LEAD_ALERT_OVERRIDE_HELP =
  "If set, lead alert email goes here instead of the primary above. Leave empty to use the primary lead alert email only.";
