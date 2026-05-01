export const LEAD_WORKFLOW_STATUSES = ["new", "open", "contacted", "archived"] as const;

export type LeadWorkflowStatus = (typeof LEAD_WORKFLOW_STATUSES)[number];

export function isLeadWorkflowStatus(value: string): value is LeadWorkflowStatus {
  return (LEAD_WORKFLOW_STATUSES as readonly string[]).includes(value);
}

/**
 * Defensive normalization for DB strings rendered in admin UI.
 * Falls back to "open" to preserve triage flow when unexpected values appear.
 */
export function normalizeLeadWorkflowStatus(value: string | null | undefined): LeadWorkflowStatus {
  if (value && isLeadWorkflowStatus(value)) return value;
  return "open";
}

