"use client";

import { useState, useTransition } from "react";
import { setLeadAssigneeAction } from "@/app/admin/leads/[id]/actions";

type FirmUser = { id: string; name: string | null; email: string };

export function LeadAssignControl({
  leadId,
  currentAssigneeId,
  firmUsers,
}: {
  leadId: string;
  currentAssigneeId: string | null;
  firmUsers: FirmUser[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const next = value === "" ? null : value;
    setError(null);
    startTransition(async () => {
      try {
        await setLeadAssigneeAction(leadId, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">Assignee</h2>
      <select
        value={currentAssigneeId ?? ""}
        onChange={handleChange}
        disabled={pending}
        className="mt-2 w-full rounded border border-[#cbd5e1] bg-[#fafaf8] px-2.5 py-1.5 text-xs text-[#334155] focus:border-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/10 disabled:opacity-60"
      >
        <option value="">— Unassigned</option>
        {firmUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name ?? u.email}
          </option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
