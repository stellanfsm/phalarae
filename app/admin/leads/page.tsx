import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/admin-context";
import { buildIntakeBriefParagraph, parseLeadSummaryJson } from "@/lib/summary";
import { splitSessionStoredData } from "@/lib/intake-session-meta";
import { FLOW_SEQUENCE } from "@/lib/intake-steps";

export const dynamic = "force-dynamic";

function tagStyle(tag: string): string {
  switch (tag) {
    case "likely_relevant":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "needs_review":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "low_relevance":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

function tagLabel(tag: string): string {
  switch (tag) {
    case "likely_relevant":
      return "Likely relevant";
    case "needs_review":
      return "Needs review";
    case "low_relevance":
      return "Low relevance";
    default:
      return tag;
  }
}

function alertStatusStyle(status: string): string {
  switch (status) {
    case "sent": return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "failed": return "bg-red-50 text-red-900 ring-red-200";
    case "no_recipient": return "bg-slate-100 text-slate-600 ring-slate-200";
    default: return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

function alertStatusLabel(status: string): string {
  switch (status) {
    case "sent": return "Sent";
    case "failed": return "Failed";
    case "no_recipient": return "No recipient";
    default: return status;
  }
}

function briefForLead(summaryJson: unknown, humanSummary: string): string {
  const parsed = parseLeadSummaryJson(summaryJson);
  if (parsed) {
    return buildIntakeBriefParagraph(parsed.intake, parsed.qualificationTag);
  }
  return humanSummary.split("\n").find((l) => l.includes("Narrative:"))?.replace(/^.*Narrative:\s*/, "").slice(0, 220) ?? "—";
}

function pilotSummary(
  sessLast7: number,
  compLast7: number,
  compPrev7: number,
  relLast7: number,
): string {
  if (sessLast7 === 0 && compLast7 === 0) {
    return "No intake sessions were started in the last 7 days.";
  }
  if (compLast7 === 0) {
    const s = sessLast7 === 1 ? "session" : "sessions";
    return `In the last 7 days, ${sessLast7} intake ${s} started but none completed.`;
  }
  const sub = compLast7 === 1 ? "submission" : "submissions";
  const flagPart =
    relLast7 === 0
      ? ", none automatically flagged for follow-up based on intake responses"
      : relLast7 === 1
      ? ", with 1 automatically flagged for follow-up based on intake responses"
      : `, with ${relLast7} automatically flagged for follow-up based on intake responses`;
  const delta = compLast7 - compPrev7;
  const trendPart =
    compPrev7 === 0 && compLast7 > 0
      ? " Up from none the previous week."
      : delta > 0
      ? ` Up ${delta} from the previous week.`
      : delta < 0
      ? ` Down ${Math.abs(delta)} from the previous week.`
      : " Consistent with the previous week.";
  return `Over the last 7 days, your intake captured ${compLast7} completed ${sub}${flagPart}.${trendPart}`;
}

function trend(cur: number, prev: number): { label: string; color: string } {
  const d = cur - prev;
  if (d === 0) return { label: "same as prior 7 days", color: "text-[#94a3b8]" };
  return {
    label: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} vs prior 7 days`,
    color: d > 0 ? "text-emerald-600" : "text-red-500",
  };
}

const STEP_LABEL: Record<string, string> = {
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  preferredContact: "Preferred contact",
  incidentType: "Incident type",
  motorVehicleInvolvement: "Vehicles involved",
  incidentDate: "Incident date",
  incidentLocation: "Incident location",
  description: "Description",
  injuries: "Injuries",
  medicalTreatment: "Medical treatment",
  otherPartyFault: "Other-party fault",
  policeReport: "Police report",
  hasAttorney: "Has attorney",
  urgent: "Urgency",
};

function stepLabel(key: string): string {
  return STEP_LABEL[key] ?? key;
}

type SessionRow = { currentStep: string; completedAt: Date | null; data: unknown };

function computeFunnelStats(sessions: SessionRow[]): {
  total: number;
  acknowledged: number;
  completed: number;
  dropoffByStep: { step: string; count: number }[];
  clarifyTotals: { field: string; rounds: number }[];
} {
  const total = sessions.length;
  const acknowledged = sessions.filter((s) => s.currentStep !== "disclaimer").length;
  const completed = sessions.filter((s) => s.completedAt !== null).length;

  const dropoffMap: Record<string, number> = {};
  for (const s of sessions) {
    if (s.completedAt === null && s.currentStep !== "disclaimer" && s.currentStep !== "complete") {
      dropoffMap[s.currentStep] = (dropoffMap[s.currentStep] ?? 0) + 1;
    }
  }
  const seqList = FLOW_SEQUENCE as readonly string[];
  const dropoffByStep = Object.entries(dropoffMap)
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => {
      const ai = seqList.indexOf(a.step);
      const bi = seqList.indexOf(b.step);
      if (ai !== -1 && bi !== -1 && ai !== bi) return ai - bi;
      return b.count - a.count;
    });

  const clarifyMap: Record<string, number> = {};
  for (const s of sessions) {
    const { meta } = splitSessionStoredData(s.data);
    for (const [field, rounds] of Object.entries(meta.clarifyRoundsByField)) {
      if (typeof rounds === "number" && rounds > 0) {
        clarifyMap[field] = (clarifyMap[field] ?? 0) + rounds;
      }
    }
  }
  const clarifyTotals = Object.entries(clarifyMap)
    .map(([field, rounds]) => ({ field, rounds }))
    .sort((a, b) => b.rounds - a.rounds);

  return { total, acknowledged, completed, dropoffByStep, clarifyTotals };
}

const VALID_FILTER_STATUSES = ["new", "open", "contacted", "archived"] as const;

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  const { status: statusParam } = await searchParams;
  const activeFilter = (VALID_FILTER_STATUSES as readonly string[]).includes(statusParam ?? "")
    ? (statusParam as typeof VALID_FILTER_STATUSES[number])
    : null;
  const statusWhere = activeFilter
    ? { workflowStatus: activeFilter }
    : { workflowStatus: { not: "archived" } };

  const sessions = await prisma.intakeSession.findMany({
    where: ctx.firmId ? { firmId: ctx.firmId } : undefined,
    select: { currentStep: true, completedAt: true, data: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const funnel = computeFunnelStats(sessions);
  const convPct = funnel.total === 0 ? 0 : Math.round((funnel.completed / funnel.total) * 100);

  const firmWhere = ctx.firmId ? { firmId: ctx.firmId } : {};
  const leads = await prisma.lead.findMany({
    where: { ...firmWhere, ...statusWhere },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      firm: { select: { name: true, slug: true } },
      assignedTo: { select: { name: true, email: true } },
    },
  });

  const tagCounts = await prisma.lead.groupBy({
    by: ["qualificationTag"],
    where: ctx.firmId ? { firmId: ctx.firmId } : undefined,
    _count: { qualificationTag: true },
  });
  const totalLeads = tagCounts.reduce((s, r) => s + r._count.qualificationTag, 0);
  const countForTag = (t: string) =>
    tagCounts.find((r) => r.qualificationTag === t)?._count.qualificationTag ?? 0;
  const likelyRelevantCount = countForTag("likely_relevant");
  const needsReviewCount = countForTag("needs_review");
  const lowRelevanceCount = countForTag("low_relevance");
  const relevantShare = totalLeads === 0 ? 0 : Math.round((likelyRelevantCount / totalLeads) * 100);

  const now = new Date();
  const cut7 = new Date(now.getTime() - 7 * 86_400_000);
  const cut14 = new Date(now.getTime() - 14 * 86_400_000);
  const fw = ctx.firmId ? { firmId: ctx.firmId } : {};
  const [sessLast7, sessPrev7, compLast7, compPrev7, relLast7, relPrev7, newLeadsCount] = await Promise.all([
    prisma.intakeSession.count({ where: { ...fw, createdAt: { gte: cut7 } } }),
    prisma.intakeSession.count({ where: { ...fw, createdAt: { gte: cut14, lt: cut7 } } }),
    prisma.intakeSession.count({ where: { ...fw, completedAt: { gte: cut7 } } }),
    prisma.intakeSession.count({ where: { ...fw, completedAt: { gte: cut14, lt: cut7 } } }),
    prisma.lead.count({ where: { ...fw, qualificationTag: "likely_relevant", createdAt: { gte: cut7 } } }),
    prisma.lead.count({ where: { ...fw, qualificationTag: "likely_relevant", createdAt: { gte: cut14, lt: cut7 } } }),
    prisma.lead.count({ where: { ...fw, workflowStatus: "new" } }),
  ]);
  const compRate7 = sessLast7 === 0 ? null : Math.round((compLast7 / sessLast7) * 100);
  const summaryText = pilotSummary(sessLast7, compLast7, compPrev7, relLast7);
  const hasNoRecipient = leads.some((l) => l.alertStatus === "no_recipient" || l.alertStatus === "failed");

  return (
    <div>
      {hasNoRecipient && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some leads were not emailed due to a configuration or delivery issue. Please review alert status.
        </div>
      )}
      <div className="rounded-xl border border-[#e2e0d9] bg-white p-5 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Snapshot · last 7 days</span>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#334155]">{summaryText}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { label: "Completed intakes", value: compLast7, trendInfo: trend(compLast7, compPrev7) },
            { label: "Likely-relevant leads", value: relLast7, trendInfo: trend(relLast7, relPrev7) },
            { label: "Completion rate", value: compRate7 === null ? "\u2014" : `${compRate7}%`, trendInfo: null as { label: string; color: string } | null },
            { label: "Sessions started", value: sessLast7, trendInfo: trend(sessLast7, sessPrev7) },
          ]).map(({ label, value, trendInfo }) => (
            <div key={label} className="rounded-lg border border-[#e2e0d9] bg-[#fafaf8] p-3">
              <div className="text-xl font-semibold text-[#0f172a]">{value}</div>
              <div className="mt-0.5 text-xs font-medium text-[#64748b]">{label}</div>
              {trendInfo ? (
                <div className={`mt-0.5 text-xs ${trendInfo.color}`}>{trendInfo.label}</div>
              ) : (
                <div className="mt-0.5 text-xs text-[#94a3b8]">last 7 days</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <h1 className="mt-6 font-serif text-2xl font-semibold text-[#0f172a]">Leads</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#64748b]">
        Recent submissions. Tags are automated routing hints only — not legal conclusions.
      </p>

      <div className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">Intake performance</h2>
        <p className="mt-1 text-xs text-[#94a3b8]">Most recent 2,000 sessions · Tags are routing hints only — not legal conclusions</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Sessions started", value: funnel.total, sub: "" },
            { label: "Completed intakes", value: funnel.completed, sub: `${convPct}% of started` },
            { label: "Completion rate", value: `${convPct}%`, sub: "" },
            { label: "Likely-relevant leads", value: likelyRelevantCount, sub: "auto-tagged for follow-up" },
            { label: "Relevant share", value: totalLeads === 0 ? "—" : `${relevantShare}%`, sub: "of completed leads" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
              <div className="text-2xl font-semibold text-[#0f172a]">{value}</div>
              <div className="mt-0.5 text-xs font-medium text-[#64748b]">{label}</div>
              {sub && <div className="mt-1 text-xs text-[#94a3b8]">{sub}</div>}
            </div>
          ))}
        </div>
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Last 7 days vs prior 7 days</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Sessions started", cur: sessLast7, prev: sessPrev7 },
              { label: "Completed intakes", cur: compLast7, prev: compPrev7 },
              { label: "Likely-relevant leads", cur: relLast7, prev: relPrev7 },
            ].map(({ label, cur, prev }) => {
              const t = trend(cur, prev);
              return (
                <div key={label} className="rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
                  <div className="text-2xl font-semibold text-[#0f172a]">{cur}</div>
                  <div className="mt-0.5 text-xs font-medium text-[#64748b]">{label}</div>
                  <div className={`mt-1 text-xs ${t.color}`}>{t.label}</div>
                </div>
              );
            })}
          </div>
        </div>
        {funnel.dropoffByStep.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Dropoff by step (incomplete sessions)</h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e2e0d9] bg-[#fafaf8] text-xs font-medium uppercase tracking-wide text-[#64748b]">
                  <tr>
                    <th className="px-4 py-2">Step stopped at</th>
                    <th className="px-4 py-2 text-right">Incomplete sessions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0eb]">
                  {funnel.dropoffByStep.map(({ step, count }) => (
                    <tr key={step} className="hover:bg-[#fafaf8]">
                      <td className="px-4 py-2 text-sm text-[#334155]">{stepLabel(step)}</td>
                      <td className="px-4 py-2 text-right text-[#475569]">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {funnel.clarifyTotals.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Clarification hotspots</h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e2e0d9] bg-[#fafaf8] text-xs font-medium uppercase tracking-wide text-[#64748b]">
                  <tr>
                    <th className="px-4 py-2">Field</th>
                    <th className="px-4 py-2 text-right">Total clarification rounds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f0eb]">
                  {funnel.clarifyTotals.map(({ field, rounds }) => (
                    <tr key={field} className="hover:bg-[#fafaf8]">
                      <td className="px-4 py-2 text-sm text-[#334155]">{stepLabel(field)}</td>
                      <td className="px-4 py-2 text-right text-[#475569]">{rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {totalLeads > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Qualification breakdown (all completed leads)</h3>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { tag: "likely_relevant", count: likelyRelevantCount },
                { tag: "needs_review", count: needsReviewCount },
                { tag: "low_relevance", count: lowRelevanceCount },
              ].map(({ tag, count }) => (
                <div key={tag} className="rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
                  <div className="text-2xl font-semibold text-[#0f172a]">{count}</div>
                  <div className="mt-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tagStyle(tag)}`}>
                      {tagLabel(tag)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[#94a3b8]">{Math.round((count / totalLeads) * 100)}% of completed leads</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        {newLeadsCount > 0 && activeFilter !== "new" && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
            <span className="text-sm font-medium text-amber-900">
              {newLeadsCount} new {newLeadsCount === 1 ? "lead" : "leads"} waiting for review
            </span>
            <Link
              href="/admin/leads?status=new"
              className="ml-auto text-xs font-medium text-amber-700 underline underline-offset-2 hover:no-underline"
            >
              View new →
            </Link>
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-1">
          {(
            [
              { label: "All", filter: null },
              { label: "New", filter: "new" },
              { label: "Open", filter: "open" },
              { label: "Contacted", filter: "contacted" },
              { label: "Archived", filter: "archived" },
            ] as { label: string; filter: string | null }[]
          ).map(({ label, filter }) => {
            const href = filter ? `/admin/leads?status=${filter}` : "/admin/leads";
            const isActive = activeFilter === filter;
            return (
              <Link
                key={label}
                href={href}
                className={
                  isActive
                    ? "rounded-lg bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-[#e2e0d9] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9]"
                }
              >
                {label}
                {label === "New" && newLeadsCount > 0 && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 text-[10px] font-semibold ${
                      isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {newLeadsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#e2e0d9] bg-[#fafaf8] text-xs font-medium uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Firm</th>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Alert</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Brief summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f0eb]">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#64748b]">
                    No leads yet. Leads will appear here once users complete the intake.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const assignee = (lead as { assignedTo?: { name: string | null; email: string } | null }).assignedTo;
                  const brief = briefForLead(lead.summaryJson, lead.humanSummary);
                  return (
                    <tr
                      key={lead.id}
                      className={
                        (lead as { workflowStatus?: string }).workflowStatus === "new"
                          ? "bg-amber-50 hover:bg-amber-100"
                          : "hover:bg-[#fafaf8]"
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-[#475569]">
                        {lead.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0f172a]">
                        <Link className="hover:underline" href={`/admin/leads/${lead.id}`}>
                          {lead.contactName ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">
                        <div className="max-w-[180px] truncate text-sm">{lead.contactEmail}</div>
                        <div className="max-w-[180px] truncate text-xs text-[#94a3b8]">{lead.contactPhone}</div>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{lead.firm.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tagStyle(lead.qualificationTag)}`}
                          title={lead.qualificationTag}
                        >
                          {tagLabel(lead.qualificationTag)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${alertStatusStyle(lead.alertStatus)}`}
                          title={lead.alertError ?? undefined}
                        >
                          {alertStatusLabel(lead.alertStatus)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        {(lead as { workflowStatus?: string }).workflowStatus === "new" && (
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
                            New
                          </span>
                        )}
                        {(lead as { workflowStatus?: string }).workflowStatus === "contacted" && (
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-200">
                            Contacted
                          </span>
                        )}
                        {(lead as { workflowStatus?: string }).workflowStatus === "archived" && (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#475569]">
                        {assignee
                          ? (assignee.name ?? assignee.email.split("@")[0])
                          : <span className="text-[#cbd5e1]">—</span>}
                      </td>
                      <td className="max-w-md px-4 py-3 text-[#475569]">
                        <p className="line-clamp-3 text-[13px] leading-relaxed">{brief}</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
