"use client";

import { useState, useTransition } from "react";
import { setFirmStatusAction } from "@/app/admin/firms/actions";
import { BLOCKER_LABELS, type FirmReadiness } from "@/lib/firm-readiness";

type FirmStatus = "pending" | "active" | "inactive";

const STATUS_CONFIG: Record<FirmStatus, { label: string; description: string }> = {
  pending: {
    label: "Pending setup",
    description: "Intake is not live. Set to Active when the firm is ready.",
  },
  active: {
    label: "Active",
    description: "Intake is live and accepting new submissions.",
  },
  inactive: {
    label: "Inactive",
    description: "Intake is disabled. Existing leads are unaffected.",
  },
};

export function FirmStatusControl({
  firmId,
  currentStatus,
  readiness,
}: {
  firmId: string;
  currentStatus: FirmStatus;
  readiness: FirmReadiness;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmingActivate, setConfirmingActivate] = useState(false);
  const [pending, startTransition] = useTransition();

  function doSetStatus(next: FirmStatus) {
    setError(null);
    setConfirmingActivate(false);
    startTransition(async () => {
      try {
        await setFirmStatusAction(firmId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleSetStatus(next: FirmStatus) {
    if (next === currentStatus) return;
    if (next === "active" && !readiness.ready && !confirmingActivate) {
      setConfirmingActivate(true);
      return;
    }
    doSetStatus(next);
  }

  const cfg = STATUS_CONFIG[currentStatus];

  return (
    <div className="rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">
        Firm status
      </h2>
      <p className="mt-1 text-xs text-[#94a3b8]">{cfg.description}</p>

      {confirmingActivate && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-900">
            This firm has setup issues. Activating will make intake live before it is fully configured:
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {readiness.blockers.map((b) => (
              <li key={b} className="text-xs text-amber-800">
                · {BLOCKER_LABELS[b].label}
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => doSetStatus("active")}
              disabled={pending}
              className="rounded border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-60"
            >
              Activate anyway
            </button>
            <button
              type="button"
              onClick={() => setConfirmingActivate(false)}
              disabled={pending}
              className="rounded border border-[#cbd5e1] bg-[#fafaf8] px-3 py-1 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!confirmingActivate && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(["pending", "active", "inactive"] as FirmStatus[]).map((s) => (
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
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
