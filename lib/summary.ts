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

/** Plain-text body for lead alert email (no raw JSON). */
export function buildLeadEmailBody(params: {
  firmName: string;
  contactName: string;
  qualificationTag: QualificationTag;
  briefParagraph: string;
  humanSummary: string;
}): string {
  return [
    `New intake lead — ${params.firmName}`,
    "",
    `Contact: ${params.contactName}`,
    `Qualification tag (non-legal routing): ${params.qualificationTag}`,
    "",
    "Summary",
    params.briefParagraph,
    "",
    "Details",
    params.humanSummary,
    "",
    "—",
    "Structured data is available in the Phalerae admin dashboard.",
  ].join("\n");
}
