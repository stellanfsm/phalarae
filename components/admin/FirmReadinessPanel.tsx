import Link from "next/link";
import { BLOCKER_LABELS, type FirmReadiness, type ReadinessBlocker } from "@/lib/firm-readiness";

const ALL_CHECKS: ReadinessBlocker[] = ["no_notification_email", "no_active_firm_admin"];

type Props = {
  firmId: string;
  readiness: FirmReadiness;
  firmStatus: string;
};

/**
 * Shown when blockers exist OR when status is not "active" (so firm admins can see what is needed
 * before the operator activates). Hidden when active + ready — no noise in the steady state.
 */
export function FirmReadinessPanel({ firmId, readiness, firmStatus }: Props) {
  const show = !readiness.ready || firmStatus !== "active";
  if (!show) return null;

  return (
    <div className="mt-6 max-w-xl rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">
        Setup checklist
      </h2>

      <ul className="mt-3 space-y-2">
        {ALL_CHECKS.map((blocker) => {
          const ok = !readiness.blockers.includes(blocker);
          const { label, hint } = BLOCKER_LABELS[blocker];
          return (
            <li key={blocker} className="flex items-start gap-2.5 text-sm">
              <span
                className={
                  ok
                    ? "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
                    : "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"
                }
                aria-hidden="true"
              >
                {ok ? "✓" : "✗"}
              </span>
              <div>
                <span className={ok ? "text-[#334155]" : "font-medium text-[#0f172a]"}>
                  {label}
                </span>
                {!ok && (
                  <p className="mt-0.5 text-xs text-[#64748b]">
                    {hint}
                    {blocker === "no_active_firm_admin" && (
                      <>
                        {" "}
                        <Link
                          href={`/admin/firms/${firmId}/users`}
                          className="underline underline-offset-2 hover:text-[#0f172a]"
                        >
                          Manage users →
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {readiness.ready && firmStatus !== "active" && (
        <p className="mt-3 text-xs text-emerald-700">
          All setup items complete — waiting for operator to activate this firm.
        </p>
      )}
    </div>
  );
}
