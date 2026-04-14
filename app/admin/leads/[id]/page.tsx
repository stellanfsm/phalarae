import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
    case "sent": return "Alert sent";
    case "failed": return "Alert failed";
    case "no_recipient": return "No recipient configured";
    default: return status;
  }
}

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const op = await getAdminOperator();
  if (!op) redirect("/admin/login");

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { firm: true, intakeSession: true },
  });
  if (!lead) notFound();
  if (op.user.firmId != null && lead.firmId !== op.user.firmId) notFound();

  const jsonPretty = JSON.stringify(lead.summaryJson, null, 2);
  const parsed = parseLeadSummaryJson(lead.summaryJson);
  const brief =
    parsed != null ? buildIntakeBriefParagraph(parsed.intake, parsed.qualificationTag) : null;

  return (
    <div>
      <Link
        href="/admin/leads"
        className="text-sm text-[#64748b] underline-offset-4 hover:text-[#0f172a] hover:underline"
      >
        ← Back to leads
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">Lead detail</h1>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tagStyle(lead.qualificationTag)}`}
        >
          {tagLabel(lead.qualificationTag)}
        </span>
      </div>
      <p className="mt-1 text-sm text-[#64748b]">
        Submitted {lead.createdAt.toLocaleString()} · Firm: {lead.firm.name} · Session:{" "}
        {lead.intakeSessionId}
      </p>

      {brief ? (
        <p className="mt-4 max-w-3xl border-l-2 border-[#cbd5e1] pl-4 text-sm leading-relaxed text-[#334155]">
          {brief}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${alertStatusStyle(lead.alertStatus)}`}
        >
          {alertStatusLabel(lead.alertStatus)}
        </span>
        {lead.alertError ? (
          <span className="text-xs text-[#94a3b8]" title={lead.alertError}>
            {lead.alertError.length > 120 ? lead.alertError.slice(0, 120) + "…" : lead.alertError}
          </span>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">
            Human-readable summary
          </h2>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#334155]">
            {lead.humanSummary}
          </pre>
        </section>
        <section className="rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">
            Structured JSON
          </h2>
          <pre className="mt-3 max-h-[480px] overflow-auto rounded-md bg-[#0f172a] p-4 font-mono text-xs text-[#e2e8f0]">
            {jsonPretty}
          </pre>
        </section>
      </div>
    </div>
  );
}
