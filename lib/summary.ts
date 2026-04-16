import {
  intakePayloadLooseSchema,
  intakePayloadSchema,
  type IntakePayload,
  type QualificationTag,
} from "@/lib/schemas/intake-data";

export type IntakeQualityFlags = {
  forceAcceptedFields: string[];
  notes?: string[];
};

export type LeadSummaryJson = {
  version: 1;
  qualificationTag: QualificationTag;
  intake: IntakePayload;
  submittedAt: string;
  intakeQuality?: IntakeQualityFlags;
};

export function buildHumanSummary(
  data: IntakePayload,
  tag: QualificationTag,
  submittedAt: Date,
  quality?: IntakeQualityFlags,
): string {
  const motorLine =
    data.incidentType === "motor_vehicle" && data.motorVehicleInvolvement
      ? `  Vehicles involved: ${data.motorVehicleInvolvement}`
      : null;

  const lines = [
    `Phalerae intake summary`,
    `Submitted: ${submittedAt.toISOString()}`,
    `Routing tag (non-legal): ${tag}`,
    ``,
    `Contact`,
    `  Name: ${data.fullName}`,
    `  Email: ${data.email}`,
    `  Phone: ${data.phone}`,
    `  Preferred contact: ${data.preferredContact}`,
    ``,
    `Incident`,
    `  Date: ${data.incidentDate}`,
    `  Location: ${data.incidentLocation}`,
    `  Type: ${data.incidentType}`,
    ...(data.incidentTypeUserText
      ? [`  Type (user wording): ${data.incidentTypeUserText}`]
      : []),
    ...(motorLine ? [motorLine] : []),
    `  Narrative: ${data.description}`,
    ``,
    `Case flags (self-reported, not verified)`,
    `  Injuries: ${data.injuries}`,
    `  Medical treatment: ${data.medicalTreatment}`,
    `  Possible other-party fault: ${data.otherPartyFault}`,
    `  Police/incident report: ${data.policeReport}`,
    `  Already represented: ${data.hasAttorney}`,
    `  Urgent (self-reported): ${data.urgent}`,
  ];
  if (quality?.forceAcceptedFields?.length) {
    lines.push(
      ``,
      `Intake quality`,
      `  Fields accepted after max clarifications (staff review): ${quality.forceAcceptedFields.join(", ")}`,
    );
    if (quality.notes?.length) {
      for (const n of quality.notes) lines.push(`  Note: ${n}`);
    }
  }
  return lines.join("\n");
}

export function buildSummaryJson(
  data: IntakePayload,
  tag: QualificationTag,
  submittedAt: Date,
  intakeQuality?: IntakeQualityFlags,
): LeadSummaryJson {
  return {
    version: 1,
    qualificationTag: tag,
    intake: data,
    submittedAt: submittedAt.toISOString(),
    ...(intakeQuality ? { intakeQuality } : {}),
  };
}

const INCIDENT_LABEL: Record<IntakePayload["incidentType"], string> = {
  motor_vehicle: "motor vehicle incident",
  slip_fall: "slip/trip and fall",
  workplace: "workplace injury",
  medical_malpractice: "medical malpractice concern",
  dog_bite: "dog bite",
  other: "incident",
};

const MOTOR_INV_LABEL: Record<NonNullable<IntakePayload["motorVehicleInvolvement"]>, string> = {
  multi_vehicle: "multi-vehicle",
  single_vehicle: "single-vehicle",
  unclear: "unclear vehicle count",
};

/** One readable paragraph for dashboard list, emails, and quick scanning (no LLM). */
export function buildIntakeBriefParagraph(data: IntakePayload, tag: QualificationTag): string {
  const kind = INCIDENT_LABEL[data.incidentType];
  const motorHint =
    data.incidentType === "motor_vehicle" && data.motorVehicleInvolvement
      ? ` (${MOTOR_INV_LABEL[data.motorVehicleInvolvement]})`
      : "";
  const inj =
    data.injuries === "yes" ? "They report injuries." : data.injuries === "no" ? "They report no injuries." : "Injury status is unclear.";
  const fault =
    data.otherPartyFault === "yes"
      ? "They believe another party may be at fault."
      : data.otherPartyFault === "no"
        ? "They do not clearly point to another party’s fault."
        : "Fault is unclear.";
  const urgent = data.urgent === "yes" ? " They marked the matter as urgent." : "";
  const atty = data.hasAttorney === "yes" ? " They already have counsel." : "";
  return `${data.fullName} (${kind}${motorHint} in ${data.incidentLocation}, ${data.incidentDate}). ${inj} ${fault} Routing tag: ${tag}.${urgent}${atty}`.trim();
}

/** Parse stored Prisma JSON into a typed summary (for admin UI). */
export function parseLeadSummaryJson(raw: unknown): LeadSummaryJson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const strict = intakePayloadSchema.safeParse(o.intake);
  const loose = strict.success ? null : intakePayloadLooseSchema.safeParse(o.intake);
  if (!strict.success && (!loose || !loose.success)) return null;
  const intake: IntakePayload = strict.success ? strict.data : (loose!.data as IntakePayload);
  const tag = o.qualificationTag;
  if (tag !== "likely_relevant" && tag !== "needs_review" && tag !== "low_relevance") return null;
  const submittedAt = typeof o.submittedAt === "string" ? o.submittedAt : "";
  if (!submittedAt) return null;
  const iq = o.intakeQuality;
  let intakeQuality: IntakeQualityFlags | undefined;
  if (iq && typeof iq === "object") {
    const force = Array.isArray((iq as { forceAcceptedFields?: unknown }).forceAcceptedFields)
      ? ((iq as { forceAcceptedFields: string[] }).forceAcceptedFields.filter(
          (x) => typeof x === "string",
        ) as string[])
      : [];
    const notes = Array.isArray((iq as { notes?: unknown }).notes)
      ? ((iq as { notes: string[] }).notes.filter((x) => typeof x === "string") as string[])
      : undefined;
    if (force.length || (notes && notes.length)) {
      intakeQuality = { forceAcceptedFields: force, notes };
    }
  }
  return {
    version: 1,
    qualificationTag: tag,
    intake,
    submittedAt,
    ...(intakeQuality ? { intakeQuality } : {}),
  };
}

const EMAIL_SEP = "─".repeat(48);

const INCIDENT_EMAIL_LABEL: Record<IntakePayload["incidentType"], string> = {
  motor_vehicle: "Motor vehicle",
  slip_fall: "Slip / trip and fall",
  workplace: "Workplace injury",
  medical_malpractice: "Medical malpractice",
  dog_bite: "Dog bite",
  other: "Other / unspecified",
};

const TAG_EMAIL_LABEL: Record<QualificationTag, string> = {
  likely_relevant: "Likely relevant",
  needs_review: "Needs review",
  low_relevance: "Low relevance",
};

function triLabel(val: string | undefined): string {
  if (val === "yes") return "Yes";
  if (val === "no") return "No";
  if (val === "unclear") return "Unclear";
  return "—";
}

/** Structured plain-text body for lead alert email. */
export function buildLeadEmailBody(params: {
  firmName: string;
  qualificationTag: QualificationTag;
  intake: IntakePayload;
  urgentSelfReported: boolean;
  submittedAt: Date;
  leadAdminUrl: string | null;
}): string {
  const { firmName, qualificationTag, intake: d, urgentSelfReported, submittedAt, leadAdminUrl } = params;
  const dateStr = submittedAt.toLocaleString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const lines: string[] = [
    `New intake submission · ${firmName}`,
    `Submitted: ${dateStr}`,
    "",
    EMAIL_SEP,
    "",
    "CONTACT",
    `  Name:   ${d.fullName}`,
    `  Phone:  ${d.phone}`,
    `  Email:  ${d.email}`,
    "",
  ];

  if (urgentSelfReported) {
    lines.push("⚠ URGENT — this person flagged their matter as needing urgent follow-up.", "");
  }

  lines.push(EMAIL_SEP, "");

  lines.push("INCIDENT");
  lines.push(`  Type:      ${INCIDENT_EMAIL_LABEL[d.incidentType]}`);
  if (d.incidentType === "motor_vehicle" && d.motorVehicleInvolvement) {
    const mvLabel =
      d.motorVehicleInvolvement === "multi_vehicle" ? "Multi-vehicle" :
      d.motorVehicleInvolvement === "single_vehicle" ? "Single vehicle" : "Unclear";
    lines.push(`  Vehicles:  ${mvLabel}`);
  }
  lines.push(`  Date:      ${d.incidentDate}`);
  lines.push(`  Location:  ${d.incidentLocation}`);
  lines.push("");

  lines.push("CASE FLAGS (self-reported, not verified)");
  lines.push(`  Injuries:          ${triLabel(d.injuries)}`);
  lines.push(`  Medical treatment: ${triLabel(d.medicalTreatment)}`);
  lines.push(`  Other-party fault: ${triLabel(d.otherPartyFault)}`);
  lines.push(`  Police report:     ${triLabel(d.policeReport)}`);
  lines.push(`  Has attorney:      ${triLabel(d.hasAttorney)}`);
  lines.push(`  Urgent:            ${triLabel(d.urgent)}`);
  lines.push("");

  lines.push("ROUTING");
  lines.push(`  Tag:  ${TAG_EMAIL_LABEL[qualificationTag]}`);
  lines.push(`  Note: Automated routing hint — not a legal conclusion.`);
  lines.push("");

  lines.push("NARRATIVE");
  lines.push(d.description);
  lines.push("");

  lines.push(EMAIL_SEP, "");
  if (leadAdminUrl) {
    lines.push(`Review in dashboard: ${leadAdminUrl}`);
  } else {
    lines.push("Log in to your admin dashboard to review this lead.");
  }
  lines.push("");
  lines.push("Tags are automated routing hints only — not legal conclusions. Always review leads directly.");

  return lines.join("\n");
}
