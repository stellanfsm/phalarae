import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminContext, requireFirmAccess } from "@/lib/admin-context";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buildIntakeBriefParagraph, parseLeadSummaryJson } from "@/lib/summary";
import type { IntakePayload } from "@/lib/schemas/intake-data";
import { LeadWorkflowControl } from "@/components/admin/LeadWorkflowControl";
import { LeadAssignControl } from "@/components/admin/LeadAssignControl";
import { LeadNoteInput } from "@/components/admin/LeadNoteInput";
import { normalizeLeadWorkflowStatus, type LeadWorkflowStatus } from "@/lib/lead-workflow";
import { leadAlertReliabilityCallout, leadAlertTriageGuidance } from "@/lib/lead-alert-status";

export const dynamic = "force-dynamic";

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

function nextStepGuidance(status: LeadWorkflowStatus, hasAssignee: boolean): string {
  if (status === "open" && !hasAssignee) return "Assign an owner, then continue triage.";
  if (status === "open") return "Review details and decide whether to contact or archive.";
  if (status === "contacted") return "Capture outreach outcome and either keep active or archive.";
  if (status === "archived") return "Lead is closed. Re-open only if follow-up becomes necessary.";
  return "Review this lead and set workflow state.";
}

function alertGuidance(alertStatus: string): string {
  return leadAlertTriageGuidance(alertStatus);
}

function formatDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

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
  const effectiveStatus: LeadWorkflowStatus = normalizeLeadWorkflowStatus(
    (lead as { workflowStatus?: string }).workflowStatus,
  );

  const jsonPretty = JSON.stringify(lead.summaryJson, null, 2);
  const parsed = parseLeadSummaryJson(lead.summaryJson);
  const intake = parsed?.intake ?? null;
  const brief = intake != null ? buildIntakeBriefParagraph(intake, parsed!.qualificationTag) : null;
  const qualityFlags = parsed?.intakeQuality;
  const hasAssignee = currentAssigneeId !== null;
  const submittedAtText = lead.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const reviewedAt = (lead as { reviewedAt?: Date | null }).reviewedAt ?? null;
  const assignedAt = (lead as { assignedAt?: Date | null }).assignedAt ?? null;
  const assignee = (lead as { assignedTo?: { name: string | null; email: string } | null }).assignedTo ?? null;
  const assigneeLabel = assignee ? (assignee.name ?? assignee.email) : "Unassigned";
  const latestNote = notes.length > 0 ? notes[notes.length - 1] : null;
  const alertReliabilityLine = leadAlertReliabilityCallout(lead.alertStatus);

  return (
    <div>
      <PageHeader
        title={lead.contactName ?? "Lead detail"}
        backHref="/admin/leads"
        backLabel="Leads"
      />

      {/* Status badges row */}
      <div className="-mt-4 mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge variant="qualification" value={lead.qualificationTag} />
        <StatusBadge variant="alert" value={lead.alertStatus} title={lead.alertError ?? undefined} />
        <StatusBadge variant="workflow" value={effectiveStatus} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Triage context</h2>
          <p className="mt-2 text-sm text-[#475569]">
            Submitted {submittedAtText} · {lead.firm.name}
          </p>
          {brief ? (
            <p className="mt-3 border-l-2 border-[#cbd5e1] pl-4 text-sm leading-relaxed text-[#334155]">
              {brief}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-[#64748b]">{alertGuidance(lead.alertStatus)}</p>
          {lead.alertError ? (
            <p className="mt-1 text-xs text-red-500" title={lead.alertError}>
              Lead alert error: {lead.alertError.length > 140 ? lead.alertError.slice(0, 140) + "…" : lead.alertError}
            </p>
          ) : null}
          {(lead.alertStatus === "failed" || lead.alertStatus === "no_recipient") ? (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-900">
                <span className="font-medium">Lead alert reliability needs attention.</span>
                {alertReliabilityLine ? <> {alertReliabilityLine}</> : null}
                {ctx.role !== "firm_staff" ? (
                  <>
                    {" "}
                    <a
                      href={`/admin/firms/${lead.firmId}#alert-settings`}
                      className="font-medium underline underline-offset-2 hover:no-underline"
                    >
                      Open lead alert settings →
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-[#e2e0d9] bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Triage actions now</h2>
          <p className="mt-2 text-sm text-[#334155]">{nextStepGuidance(effectiveStatus, hasAssignee)}</p>
          <div className="mt-3 space-y-3">
            <LeadWorkflowControl leadId={lead.id} currentStatus={effectiveStatus} />
            <LeadAssignControl
              leadId={lead.id}
              currentAssigneeId={currentAssigneeId}
              firmUsers={firmUsers}
            />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[#e2e0d9] bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Handling timeline</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#94a3b8]">Submitted</dt>
            <dd className="mt-0.5 text-[#334155]">{submittedAtText}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#94a3b8]">First reviewed</dt>
            <dd className="mt-0.5 text-[#334155]">{formatDateTime(reviewedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#94a3b8]">Current assignee</dt>
            <dd className="mt-0.5 text-[#334155]">{assigneeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[#94a3b8]">Assigned at</dt>
            <dd className="mt-0.5 text-[#334155]">{formatDateTime(assignedAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-[#94a3b8]">Latest note activity</dt>
            <dd className="mt-0.5 text-[#334155]">
              {latestNote
                ? `${latestNote.author.name ?? latestNote.author.email} · ${latestNote.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                : "No notes yet"}
            </dd>
          </div>
        </dl>
      </section>

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
