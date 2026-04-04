import type { IntakePayload } from "@/lib/schemas/intake-data";

/**
 * Strict collection order after disclaimer:
 * incident → qualification tri-states → contact.
 * motorVehicleInvolvement is asked only when incidentType === motor_vehicle.
 * urgent is skipped when hasAttorney === yes (stored as urgent "no" via applyIntakeDefaults).
 */
export const FLOW_SEQUENCE = [
  "incidentType",
  "motorVehicleInvolvement",
  "description",
  "incidentDate",
  "incidentLocation",
  "injuries",
  "medicalTreatment",
  "otherPartyFault",
  "policeReport",
  "hasAttorney",
  "urgent",
  "fullName",
  "email",
  "phone",
  "preferredContact",
] as const satisfies readonly (keyof IntakePayload)[];

export type FlowStepKey = (typeof FLOW_SEQUENCE)[number];

export type FlowStep = "disclaimer" | FlowStepKey | "complete";

const ALL_STEP_KEYS = new Set<string>(FLOW_SEQUENCE);

export function isFlowStepKey(s: string): s is FlowStepKey {
  return ALL_STEP_KEYS.has(s);
}

/** @deprecated Use FLOW_SEQUENCE — kept for any external imports */
export const INTAKE_FIELD_KEYS = FLOW_SEQUENCE;

/** @deprecated Use isFlowStepKey */
export const isIntakeFieldKey = isFlowStepKey;

/** @deprecated Use FlowStepKey */
export type IntakeFieldKey = FlowStepKey;

const QUESTIONS: Record<FlowStepKey, string> = {
  incidentType:
    "What type of incident was this? (motor vehicle collision, slip/trip and fall, workplace injury, medical malpractice, dog bite, or other — reply with the one that fits best.)",
  motorVehicleInvolvement: "Was this a multi-vehicle accident or a single-vehicle crash?",
  description: "In a few sentences, what happened? Facts only — an attorney will review details later.",
  incidentDate: "What date did this happen, or your best estimate? (Month/day/year is fine.)",
  incidentLocation: "Where did this happen (city and state, or as specific as you’re comfortable)?",
  injuries: "Were you injured? (yes / no / not sure)",
  medicalTreatment: "Have you received medical treatment related to this? (yes / no / not sure)",
  otherPartyFault: "Do you believe someone else may have been at fault? (yes / no / not sure)",
  policeReport: "Was a police or incident report filed? (yes / no / not sure)",
  hasAttorney: "Do you already have an attorney for this matter? (yes / no / not sure)",
  urgent: "Is follow-up urgent for you? (yes / no / not sure)",
  fullName: "What is your full legal name?",
  email: "What is the best email address to reach you?",
  phone: "What is a good phone number to reach you?",
  preferredContact: "How should we contact you — email, phone, or either?",
};

/** Alternate phrasings — same deterministic order, reduces repeated identical prompts. */
const QUESTION_VARIANTS: Partial<Record<FlowStepKey, string[]>> = {
  incidentType: [
    "Which category fits best: motor vehicle, slip/trip and fall, workplace, medical malpractice, dog bite, or something else?",
  ],
  description: [
    "Briefly describe what happened (just the facts you’re comfortable sharing).",
    "A short summary of the incident is enough for now — a lawyer can follow up for more detail later.",
  ],
  incidentDate: [
    "When did this occur? Approximate date is fine (e.g. month/year).",
  ],
  incidentLocation: [
    "Which city and state did this take place in?",
  ],
  injuries: [
    "Were you physically injured? Reply yes, no, or not sure.",
  ],
  email: [
    "What email should we use to reach you?",
  ],
  phone: [
    "Best phone number (with area code)?",
  ],
};

export function assistantPromptForField(
  key: FlowStepKey,
  opts?: { variantIndex?: number; avoidDuplicateOf?: string },
): string {
  const base = QUESTIONS[key];
  const extra = QUESTION_VARIANTS[key];
  const list = extra?.length ? [base, ...extra] : [base];
  let idx = Math.min(Math.max(opts?.variantIndex ?? 0, 0), list.length - 1);
  let text = list[idx] ?? base;
  if (opts?.avoidDuplicateOf && text === opts.avoidDuplicateOf && list.length > 1) {
    idx = (idx + 1) % list.length;
    text = list[idx] ?? base;
  }
  return text;
}

/** All fields still missing, in flow order (respects motor + attorney skips). */
export function allMissingFields(data: Partial<IntakePayload>): FlowStepKey[] {
  const d = applyIntakeDefaults(data);
  const out: FlowStepKey[] = [];
  for (const key of FLOW_SEQUENCE) {
    if (key === "motorVehicleInvolvement") {
      if (d.incidentType !== "motor_vehicle") continue;
      if (d.motorVehicleInvolvement === undefined) out.push(key);
      continue;
    }
    if (key === "urgent") {
      if (d.hasAttorney === "yes") continue;
      if (d.urgent === undefined) out.push(key);
      continue;
    }
    if (d[key] === undefined) out.push(key);
  }
  return out;
}

/** Short UX notes about conditional skips (not counted as questions). */
export function intakeProgressHints(data: Partial<IntakePayload>): string[] {
  const d = applyIntakeDefaults(data);
  const hints: string[] = [];
  if (d.incidentType != null && d.incidentType !== "motor_vehicle") {
    hints.push("Follow-up about number of vehicles is skipped when the incident isn’t a motor vehicle case.");
  }
  if (d.hasAttorney === "yes") {
    hints.push("The urgency question is skipped when you already have an attorney.");
  }
  return hints;
}

/** Auto-fill when we skip asking (e.g. urgency after they already have counsel). */
export function applyIntakeDefaults(data: Partial<IntakePayload>): Partial<IntakePayload> {
  const out: Partial<IntakePayload> = { ...data };
  if (out.hasAttorney === "yes" && out.urgent === undefined) {
    out.urgent = "no";
  }
  return out;
}

/** Keys that will be collected for this partial payload (respects motor + attorney branches). */
export function flowKeysForData(data: Partial<IntakePayload>): FlowStepKey[] {
  const d = applyIntakeDefaults(data);
  const out: FlowStepKey[] = [];
  for (const key of FLOW_SEQUENCE) {
    if (key === "motorVehicleInvolvement") {
      if (d.incidentType === "motor_vehicle") out.push(key);
      continue;
    }
    if (key === "urgent") {
      if (d.hasAttorney !== "yes") out.push(key);
      continue;
    }
    out.push(key);
  }
  return out;
}

export function firstMissingField(data: Partial<IntakePayload>): FlowStepKey | null {
  const d = applyIntakeDefaults(data);
  for (const key of FLOW_SEQUENCE) {
    if (key === "motorVehicleInvolvement") {
      if (d.incidentType !== "motor_vehicle") continue;
      if (d.motorVehicleInvolvement === undefined) return "motorVehicleInvolvement";
      continue;
    }
    if (key === "urgent") {
      if (d.hasAttorney === "yes") continue;
      if (d.urgent === undefined) return "urgent";
      continue;
    }
    if (d[key] === undefined) return key;
  }
  return null;
}

/** Step indicator: next question number and how many questions this path will ask. */
export function intakeProgressLabel(data: Partial<IntakePayload>): { step: number; total: number } {
  const d = applyIntakeDefaults(data);
  const keys = flowKeysForData(d);
  const total = keys.length;
  let completed = 0;
  for (const k of keys) {
    const v = d[k];
    if (v !== undefined && v !== "") completed++;
    else break;
  }
  const step = total === 0 ? 1 : Math.min(completed + 1, total);
  return { step, total };
}
