import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminContext, requireFirmAccess } from "@/lib/admin-context";
import { buildIntakeBriefParagraph, parseLeadSummaryJson } from "@/lib/summary";
import type { IntakePayload } from "@/lib/schemas/intake-data";
import { LeadWorkflowControl } from "@/components/admin/LeadWorkflowControl";
import { LeadAssignControl } from "@/components/admin/LeadAssignControl";
import { LeadNoteInput } from "@/components/admin/LeadNoteInput";

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

type WorkflowStatus = "new" | "open" | "contacted" | "archived";

function workflowStatusStyle(status: string): string {
  switch (status) {
    case "new": return "bg-amber-50 text-amber-800 ring-amber-200";
    case "open": return "bg-slate-100 text-slate-600 ring-slate-200";
    case "contacted": return "bg-blue-50 text-blue-800 ring-blue-200";
    case "archived": return "bg-slate-100 text-slate-500 ring-slate-200";
    default: return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

function workflowStatusLabel(status: string): string {
  switch (status) {
    case "new": return "New";
    case "open": return "Open";
    case "contacted": return "Contacted";
    case "archived": return "Archived";
    default: return status;
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

function triStateDisplay(val: string | undefined): string {
  switch (val) {
    case "yes": return "Yes";
    case "no": return "No";
    case "unclear": return "Unclear / not sure";
    default: return "—";
  }
}

function incidentTypeDisplay(val: IntakePayload["incidentType"]): string {
  switch (val) {
    case "motor_vehicle": return "Motor vehicle";
    case "slip_fall": return "Slip / trip and fall";
    case "workplace": return "Workplace injury";
    case "medical_malpractice": return "Medical malpractice";
    case "dog_bite": return "Dog bite";
    case "other": return "Other / unspecified";
  }
}

function motorInvolvementDisplay(val: IntakePayload["motorVehicleInvolvement"]): string {
  switch (val) {
    case "multi_vehicle": return "Multi-vehicle";
    case "single_vehicle": return "Single vehicle";
    case "unclear": return "Unclear";
    default: return "—";
  }
}

function preferredContactDisplay(val: IntakePayload["preferredContact"]): string {
  switch (val) {
    case "email": return "Email";
    case "phone": return "Phone";
    case "either": return "Either / no preference";
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[#64748b]">{label}</dt>
      <dd className="mt-0.5 text-sm text-[#0f172a]">{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{title}</h2>
      <dl className="mt-4 space-y-3">{children}</dl>
    </section>
  );
}

type NoteWithAuthor = {
  id: string;
  content: string;
  createdAt: Date;
  author: { name: string | null; email: string };
};

type FirmUser = { id: string; name: string | null; email: string };

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      firm: true,
      intakeSession: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      notes: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!lead) notFound();
  requireFirmAccess(ctx, lead.firmId);

  const notes = ((lead as unknown as { notes?: NoteWithAuthor[] }).notes ?? []) as NoteWithAuthor[];
  const currentAssigneeId =
    (lead as unknown as { assignedToId?: string | null }).assignedToId ?? null;
  const firmUsers: FirmUser[] = await prisma.adminUser.findMany({
    where: { firmId: lead.firmId, deactivatedAt: null, role: { in: ["firm_admin", "firm_staff"] } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  if ((lead as { workflowStatus?: string }).workflowStatus === "new") {
    await prisma.lead.update({
      where: { id },
      data: { workflowStatus: "open", reviewedAt: new Date() },
    });
    (lead as { workflowStatus?: string }).workflowStatus = "open";
  }
  const effectiveStatus = ((lead as { workflowStatus?: string }).workflowStatus ?? "open") as WorkflowStatus;

  const jsonPretty = JSON.stringify(lead.summaryJson, null, 2);
  const parsed = parseLeadSummaryJson(lead.summaryJson);
  const intake = parsed?.intake ?? null;
  const brief = intake != null ? buildIntakeBriefParagraph(intake, parsed!.qualificationTag) : null;
  const qualityFlags = parsed?.intakeQuality;

  return (
    <div>
      <Link
        href="/admin/leads"
        className="text-sm text-[#64748b] underline-offset-4 hover:text-[#0f172a] hover:underline"
      >
        ← Back to leads
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start gap-3 sm:items-center">
        <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">
          {lead.contactName ?? "Lead detail"}
        </h1>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tagStyle(lead.qualificationTag)}`}
        >
          {tagLabel(lead.qualificationTag)}
        </span>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${alertStatusStyle(lead.alertStatus)}`}
          title={lead.alertError ?? undefined}
        >
          {alertStatusLabel(lead.alertStatus)}
        </span>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${workflowStatusStyle(effectiveStatus)}`}
        >
          {workflowStatusLabel(effectiveStatus)}
        </span>
      </div>
      <p className="mt-1 text-sm text-[#64748b]">
        Submitted {lead.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {lead.firm.name}
      </p>
      {lead.alertError ? (
        <p className="mt-1 text-xs text-red-500" title={lead.alertError}>
          Alert error: {lead.alertError.length > 140 ? lead.alertError.slice(0, 140) + "…" : lead.alertError}
        </p>
      ) : null}

      {/* Brief summary */}
      {brief ? (
        <p className="mt-4 max-w-3xl border-l-2 border-[#cbd5e1] pl-4 text-sm leading-relaxed text-[#334155]">
          {brief}
        </p>
      ) : null}

      <div className="mt-6 max-w-sm space-y-3">
        <LeadWorkflowControl leadId={lead.id} currentStatus={effectiveStatus} />
        <LeadAssignControl
          leadId={lead.id}
          currentAssigneeId={currentAssigneeId}
          firmUsers={firmUsers}
        />
      </div>

      {intake != null ? (
        <>
          {/* Structured detail grid */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* LEFT: Contact + Incident */}
            <div className="space-y-4">
              <Card title="Contact">
                <Field label="Full name">{intake.fullName}</Field>
                <Field label="Email">
                  <a href={`mailto:${intake.email}`} className="text-[#1e3a5f] underline underline-offset-2 hover:no-underline">
                    {intake.email}
                  </a>
                </Field>
                <Field label="Phone">
                  <a href={`tel:${intake.phone}`} className="text-[#1e3a5f] underline underline-offset-2 hover:no-underline">
                    {intake.phone}
                  </a>
                </Field>
                <Field label="Preferred contact">{preferredContactDisplay(intake.preferredContact)}</Field>
              </Card>

              <Card title="Incident">
                <Field label="Type">{incidentTypeDisplay(intake.incidentType)}</Field>
                {intake.incidentType === "motor_vehicle" && (
                  <Field label="Vehicles involved">{motorInvolvementDisplay(intake.motorVehicleInvolvement)}</Field>
                )}
                {intake.incidentTypeUserText &&
                  intake.incidentTypeUserText !== incidentTypeDisplay(intake.incidentType) ? (
                  <Field label="User's description">
                    <span className="italic text-[#475569]">{intake.incidentTypeUserText}</span>
                  </Field>
                ) : null}
                <Field label="Date">{intake.incidentDate}</Field>
                <Field label="Location">{intake.incidentLocation}</Field>
              </Card>
            </div>

            {/* RIGHT: Case flags */}
            <div className="space-y-4">
              <Card title="Case flags (self-reported, not verified)">
                <Field label="Injuries">{triStateDisplay(intake.injuries)}</Field>
                <Field label="Medical treatment">{triStateDisplay(intake.medicalTreatment)}</Field>
                <Field label="Other party at fault">{triStateDisplay(intake.otherPartyFault)}</Field>
                <Field label="Police / incident report">{triStateDisplay(intake.policeReport)}</Field>
                <Field label="Already has attorney">{triStateDisplay(intake.hasAttorney)}</Field>
                <Field label="Urgent (self-reported)">
                  {intake.hasAttorney === "yes" && intake.urgent === "no"
                    ? "N/A — has existing counsel"
                    : triStateDisplay(intake.urgent)}
                </Field>
                {qualityFlags && (qualityFlags.forceAcceptedFields.length > 0 || qualityFlags.notes?.length) ? (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-medium text-amber-900">Staff review recommended</p>
                    {qualityFlags.forceAcceptedFields.length > 0 ? (
                      <p className="mt-0.5 text-xs text-amber-800">
                        Fields accepted after repeated clarification: {qualityFlags.forceAcceptedFields.join(", ")}
                      </p>
                    ) : null}
                    {qualityFlags.notes?.map((n, i) => (
                      <p key={i} className="mt-0.5 text-xs text-amber-800">{n}</p>
                    ))}
                  </div>
                ) : null}
              </Card>
            </div>
          </div>

          {/* Narrative — full width */}
          <section className="mt-4 rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Narrative</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#334155]">{intake.description}</p>
          </section>
        </>
      ) : (
        /* Fallback for leads that predate structured parsing */
        <section className="mt-6 rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Summary</h2>
          <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">
            {lead.humanSummary}
          </pre>
        </section>
      )}

      {/* Notes */}
      <section className="mt-6 rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Notes</h2>
        {notes.length === 0 ? (
          <p className="mt-3 text-sm text-[#94a3b8]">No notes yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-[#f1f0eb]">
            {notes.map((note) => (
              <div key={note.id} className="py-3 first:pt-0">
                <p className="text-xs text-[#64748b]">
                  <span className="font-medium text-[#334155]">
                    {note.author.name ?? note.author.email}
                  </span>
                  {" · "}
                  {note.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#334155]">{note.content}</p>
              </div>
            ))}
          </div>
        )}
        <LeadNoteInput leadId={lead.id} />
      </section>

      {/* Raw data — collapsed by default */}
      <details className="mt-6">
        <summary className="cursor-pointer select-none text-xs text-[#94a3b8] hover:text-[#64748b]">
          Raw data (for reference)
        </summary>
        <pre className="mt-3 max-h-[480px] overflow-auto rounded-md bg-[#0f172a] p-4 font-mono text-xs text-[#e2e8f0]">
          {jsonPretty}
        </pre>
      </details>
    </div>
  );
}
