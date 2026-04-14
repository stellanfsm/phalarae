import type { FlowStepKey } from "@/lib/intake-steps";
import type { IntakePayload } from "@/lib/schemas/intake-data";

/** Stored inside Prisma IntakeSession.data JSON alongside payload fields. */
export const INTAKE_SESSION_META_KEY = "__intakeMeta" as const;

export type IntakeSessionMeta = {
  /** Clarification rounds already sent for a field while it was still the active target. */
  clarifyRoundsByField: Partial<Record<FlowStepKey, number>>;
  /** Last assistant prompt text per field (dedupe / rephrase). */
  lastPromptByField: Partial<Record<FlowStepKey, string>>;
  /** Variant index for adaptive rewording (0 = base). */
  promptVariantByField: Partial<Record<FlowStepKey, number>>;
  /** Fields accepted on max-clarify path (admin review). */
  forceAcceptedFields: FlowStepKey[];
  /** Raw user text for incident type before normalization. */
  incidentTypeRaw?: string;
  /** Forces needs_review tag at completion when true. */
  qualityRequiresReview: boolean;
};

export function defaultIntakeSessionMeta(): IntakeSessionMeta {
  return {
    clarifyRoundsByField: {},
    lastPromptByField: {},
    promptVariantByField: {},
    forceAcceptedFields: [],
    qualityRequiresReview: false,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseIntakeSessionMetaBlob(m: unknown): IntakeSessionMeta {
  const base = defaultIntakeSessionMeta();
  if (!isPlainObject(m)) return base;
  const clarify = m.clarifyRoundsByField;
  const last = m.lastPromptByField;
  const variant = m.promptVariantByField;
  const force = m.forceAcceptedFields;
  return {
    clarifyRoundsByField: isPlainObject(clarify) ? (clarify as Partial<Record<FlowStepKey, number>>) : {},
    lastPromptByField: isPlainObject(last) ? (last as Partial<Record<FlowStepKey, string>>) : {},
    promptVariantByField: isPlainObject(variant) ? (variant as Partial<Record<FlowStepKey, number>>) : {},
    forceAcceptedFields: Array.isArray(force)
      ? (force.filter((x) => typeof x === "string") as FlowStepKey[])
      : [],
    incidentTypeRaw: typeof m.incidentTypeRaw === "string" ? m.incidentTypeRaw : undefined,
    qualityRequiresReview: m.qualityRequiresReview === true,
  };
}

/** Split session JSON blob into typed payload + meta. */
export function splitSessionStoredData(raw: unknown): {
  payload: Partial<IntakePayload>;
  meta: IntakeSessionMeta;
} {
  if (!isPlainObject(raw)) {
    return { payload: {}, meta: defaultIntakeSessionMeta() };
  }
  const { [INTAKE_SESSION_META_KEY]: metaBlob, ...rest } = raw as Record<string, unknown>;
  const meta = parseIntakeSessionMetaBlob(metaBlob);
  return { payload: rest as Partial<IntakePayload>, meta };
}

export function mergeSessionStoredData(
  payload: Partial<IntakePayload>,
  meta: IntakeSessionMeta,
): Record<string, unknown> {
  return {
    ...payload,
    [INTAKE_SESSION_META_KEY]: {
      clarifyRoundsByField: meta.clarifyRoundsByField,
      lastPromptByField: meta.lastPromptByField,
      promptVariantByField: meta.promptVariantByField,
      forceAcceptedFields: meta.forceAcceptedFields,
      incidentTypeRaw: meta.incidentTypeRaw,
      qualityRequiresReview: meta.qualityRequiresReview,
    },
  };
}

export const MAX_CLARIFY_ROUNDS_BEFORE_FORCE = 3;

/**
 * Fields that support force-accept after max clarification rounds.
 * email and phone are excluded: their Zod schemas require specific formats
 * (valid email address, ≥10 digit phone), so a force-accepted raw string would
 * fail intakePayloadSchema.parse() at completion. For those fields, continued
 * clarification is the only path — a lead without contact info cannot be followed up.
 */
export function fieldSupportsForceAccept(key: FlowStepKey): boolean {
  return key !== "email" && key !== "phone";
}
