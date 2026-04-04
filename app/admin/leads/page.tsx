import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminOperator } from "@/lib/admin-operator";
import { buildIntakeBriefParagraph, parseLeadSummaryJson } from "@/lib/summary";

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

function briefForLead(summaryJson: unknown, humanSummary: string): string {
  const parsed = parseLeadSummaryJson(summaryJson);
  if (parsed) {
    return buildIntakeBriefParagraph(parsed.intake, parsed.qualificationTag);
  }
  return humanSummary.split("\n").find((l) => l.includes("Narrative:"))?.replace(/^.*Narrative:\s*/, "").slice(0, 220) ?? "—";
}

export default async function AdminLeadsPage() {
  const op = await getAdminOperator();
  if (!op) redirect("/admin/login");

  const leads = await prisma.lead.findMany({
    where: op.user.firmId ? { firmId: op.user.firmId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { firm: { select: { name: true, slug: true } } },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">Leads</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#64748b]">
        Recent submissions. Tags are automated routing hints only — not legal conclusions. Edit rules in{" "}
        <code className="rounded bg-[#f1f5f9] px-1 font-mono text-xs">lib/qualify.ts</code>.
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#e2e0d9] bg-[#fafaf8] text-xs font-medium uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Firm</th>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Brief summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f0eb]">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#64748b]">
                    No leads yet. Complete an intake at{" "}
                    <Link className="text-[#0f172a] underline" href="/intake/demo">
                      /intake/demo
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const brief = briefForLead(lead.summaryJson, lead.humanSummary);
                  return (
                    <tr key={lead.id} className="hover:bg-[#fafaf8]">
                      <td className="whitespace-nowrap px-4 py-3 text-[#475569]">
                        {lead.createdAt.toLocaleString()}
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
