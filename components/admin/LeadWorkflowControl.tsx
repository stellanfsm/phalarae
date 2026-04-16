"use client";

import { useState, useTransition } from "react";
import { setLeadWorkflowStatusAction } from "@/app/admin/leads/[id]/actions";

type WorkflowStatus = "new" | "open" | "contacted" | "archived";

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; description: string }> = {
  new: {
    label: "New",
    description: "Not yet reviewed.",
  },
  open: {
    label: "Open",
    description: "Reviewed — no action taken yet.",
  },
  contacted: {
    label: "Contacted",
    description: "Someone has reached out to this lead.",
  },
  archived: {
    label: "Archived",
    description: "Dismissed — not pursuing.",
  },
};

/**
 * Buttons rendered: Open | Contacted | Archived
 * "new" is intentionally omitted — leads auto-transition to "open" on first view.
 * Users never manually set a lead back to new.
 */
const VISIBLE_STATUSES: WorkflowStatus[] = ["open", "contacted", "archived"];

export function LeadWorkflowControl({
  leadId,
  currentStatus,
}: {
  leadId: string;
  currentStatus: WorkflowStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSetStatus(next: WorkflowStatus) {
    if (next === currentStatus) return;
    setError(null);
    startTransition(async () => {
      try {
        await setLeadWorkflowStatusAction(leadId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const cfg = STATUS_CONFIG[currentStatus];

  return (
    <div className="rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">
        Workflow
      </h2>
      <p className="mt-1 text-xs text-[#94a3b8]">{cfg.description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {VISIBLE_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSetStatus(s)}
            disabled={pending || s === currentStatus}
            className={
              s === currentStatus
                ? "cursor-default rounded border border-[#cbd5e1] bg-[#f1f5f9] px-3 py-1.5 text-xs font-semibold text-[#334155]"
                : "rounded border border-[#cbd5e1] bg-[#fafaf8] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-60"
            }
          >
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
