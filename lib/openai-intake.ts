import OpenAI from "openai";
import { z } from "zod";
import { applyIntakeDefaults, FLOW_SEQUENCE, isFlowStepKey, type FlowStepKey } from "@/lib/intake-steps";
import type { IntakePayload } from "@/lib/schemas/intake-data";
import {
  confidenceThresholdForField,
  extractDeterministicMultiField,
  type ParsedFieldUpdate,
} from "@/lib/intake-multi-extract";
import { parseFieldValueForKey, validateFieldKey } from "@/lib/intake-parse-field";
import { phoneFormatHint } from "@/lib/intake-normalize";

export type { ParsedFieldUpdate };

/** @deprecated Use parseFieldValueForKey */
export const parseFieldValue = parseFieldValueForKey;

const extractionSchema = z.object({
  field: z.string(),
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const multiResponseSchema = z.object({
  classification: z.enum(["answer", "legal_advice_request", "off_topic"]),
  extractions: z.array(extractionSchema).default([]),
  assistantReply: z.string().max(2000),
});

export type LlmTurnResult =
  | { kind: "legal_refusal"; reply: string }
  | { kind: "off_topic"; reply: string }
  | { kind: "clarify"; reply: string; targetField: FlowStepKey }
  | { kind: "answer"; updates: ParsedFieldUpdate[]; reply: string };

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

const INCIDENT_TYPES =
  "motor_vehicle | slip_fall | workplace | medical_malpractice | dog_bite | other";

function fieldHint(key: FlowStepKey): string {
  switch (key) {
    case "preferredContact":
      return "Normalize to exactly one of: email | phone | either (both maps to either)";
    case "incidentType":
      return `Normalize to one of: ${INCIDENT_TYPES}. Preserve user wording in value text if needed.`;
    case "motorVehicleInvolvement":
      return "Normalize to one of: multi_vehicle | single_vehicle | unclear";
    case "injuries":
    case "medicalTreatment":
    case "otherPartyFault":
    case "policeReport":
    case "hasAttorney":
    case "urgent":
      return "Normalize to exactly one of: yes | no | unclear (not sure → unclear)";
    default:
      return "Use the user's text, trimmed; do not invent facts.";
  }
}

export function clarifyPrompt(key: FlowStepKey, userText?: string): string {
  switch (key) {
    case "phone": {
      const hint = userText ? phoneFormatHint(userText) : null;
      return (
        hint ??
        "Please enter a 10-digit U.S. phone number with area code (digits only is fine)."
      );
    }
    case "email":
      return "That email doesn’t look valid. Try again — you can use name@domain.com format (or “name at domain dot com”).";
    case "preferredContact":
      return "Reply with email, phone, either, or both (both counts as either).";
    case "motorVehicleInvolvement":
      return "Was it multiple vehicles involved, or a single-vehicle crash? (Or say not sure.)";
    case "incidentType":
      return "Pick the closest type: motor vehicle, slip/trip and fall, workplace, medical malpractice, dog bite, or other.";
    case "description":
      return "Please add a bit more detail (at least a sentence) so our team understands what happened.";
    default:
      if (
        key === "injuries" ||
        key === "medicalTreatment" ||
        key === "otherPartyFault" ||
        key === "policeReport" ||
        key === "hasAttorney" ||
        key === "urgent"
      ) {
        return "Please answer yes, no, or not sure.";
      }
      return "Could you give a bit more specific information?";
  }
}

function flowIndex(k: FlowStepKey): number {
  return FLOW_SEQUENCE.indexOf(k);
}

function mergeByConfidence(a: ParsedFieldUpdate[], b: ParsedFieldUpdate[]): ParsedFieldUpdate[] {
  const map = new Map<FlowStepKey, ParsedFieldUpdate>();
  for (const u of [...a, ...b]) {
    const cur = map.get(u.key);
    if (!cur || u.confidence > cur.confidence) map.set(u.key, u);
  }
  return [...map.values()].sort((x, y) => flowIndex(x.key) - flowIndex(y.key));
}

function filterByThreshold(updates: ParsedFieldUpdate[]): ParsedFieldUpdate[] {
  return updates.filter((u) => u.confidence >= confidenceThresholdForField(u.key));
}

function simulateApply(partial: Partial<IntakePayload>, updates: ParsedFieldUpdate[]): Partial<IntakePayload> {
  let d: Partial<IntakePayload> = { ...applyIntakeDefaults(partial) };
  const ordered = [...updates].sort((a, b) => flowIndex(a.key) - flowIndex(b.key));
  for (const u of ordered) {
    d = { ...d, [u.key]: u.value as never };
    d = applyIntakeDefaults(d);
  }
  return d;
}

function llmExtractionsToUpdates(items: z.infer<typeof extractionSchema>[]): ParsedFieldUpdate[] {
  const out: ParsedFieldUpdate[] = [];
  for (const item of items) {
    if (!isFlowStepKey(item.field)) continue;
    const key = item.field;
    const rawVal = item.value;
    if (rawVal == null || String(rawVal).trim() === "") continue;
    const coerced = parseFieldValueForKey(key, String(rawVal));
    if (coerced === null || !validateFieldKey(key, coerced)) continue;
    let conf = Math.min(1, Math.max(0, item.confidence));
    if (conf < 0.25) conf = 0.55;
    out.push({ key, value: coerced, confidence: conf });
  }
  return out;
}

export async function interpretIntakeTurn(params: {
  fieldKey: FlowStepKey;
  userText: string;
  conversationTail: { role: "user" | "assistant"; content: string }[];
  partialPayload: Partial<IntakePayload>;
}): Promise<LlmTurnResult> {
  const deterministic = extractDeterministicMultiField(
    params.fieldKey,
    params.userText,
    params.partialPayload,
  );

  const openai = client();
  if (!openai) {
    const merged = filterByThreshold(deterministic);
    const sim = simulateApply(params.partialPayload, merged);
    if (sim[params.fieldKey] === undefined) {
      return {
        kind: "clarify",
        targetField: params.fieldKey,
        reply: clarifyPrompt(params.fieldKey, params.userText),
      };
    }
    return { kind: "answer", updates: merged, reply: "" };
  }

  const missingHint = `Active field (must be satisfied or co-filled from message): ${params.fieldKey}.`;
  const system = [
    "You help a law firm intake assistant. Never give legal advice.",
    "If the user asks for a legal opinion, case value, strategy, or statutes, classify legal_advice_request: refuse briefly; only a licensed attorney can advise; invite them to continue intake.",
    "If off-topic or refusing to answer, classify off_topic and redirect to the current question only.",
    "Otherwise classification is answer.",
    "For answer: extract ALL field values you can confidently infer from the latest user message for the intake flow. Include the active field and any later fields (e.g. date + description in one message).",
    "Return extractions as an array of { field, value, confidence } where field is the exact snake_case key (e.g. incidentDate, incidentType, description). confidence is 0-1.",
    "Do not invent facts. If unsure, omit that field from extractions.",
    "assistantReply should be empty when extractions are sufficient; otherwise one short clarifying question.",
    missingHint,
    `Hints for active field ${params.fieldKey}: ${fieldHint(params.fieldKey)}`,
    'Return JSON: {"classification":"answer"|"legal_advice_request"|"off_topic","extractions":[...],"assistantReply":string}',
  ].join("\n");

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...params.conversationTail.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: params.userText },
  ];

  let llmUpdates: ParsedFieldUpdate[] = [];
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.15,
    }, { timeout: 8000 });
    const raw = completion.choices[0]?.message?.content;
    if (raw) {
      const parsed = multiResponseSchema.parse(JSON.parse(raw));
      if (parsed.classification === "legal_advice_request") {
        return {
          kind: "legal_refusal",
          reply:
            parsed.assistantReply.trim() ||
            "I can’t provide legal advice. A licensed attorney would need to evaluate that. Let’s continue with intake, or our staff can follow up.",
        };
      }
      if (parsed.classification === "off_topic") {
        return {
          kind: "off_topic",
          reply: parsed.assistantReply.trim() || clarifyPrompt(params.fieldKey, params.userText),
        };
      }
      llmUpdates = llmExtractionsToUpdates(parsed.extractions);
    }
  } catch (e) {
    console.warn("[openai] interpretIntakeTurn failed, falling back to deterministic extraction:", e);
    llmUpdates = [];
  }

  const merged = filterByThreshold(mergeByConfidence(deterministic, llmUpdates));
  const sim = simulateApply(params.partialPayload, merged);

  if (sim[params.fieldKey] === undefined) {
    return {
      kind: "clarify",
      targetField: params.fieldKey,
      reply: clarifyPrompt(params.fieldKey, params.userText),
    };
  }

  return { kind: "answer", updates: merged, reply: "" };
}

/** Heuristic single-field path (tests / fallback) */
export function extractWithoutLlm(
  key: FlowStepKey,
  userText: string,
): { value: unknown; reply: string } {
  const value = parseFieldValueForKey(key, userText);
  const ok = value !== null && validateFieldKey(key, value);
  return {
    value: ok ? value : null,
    reply: ok ? "" : clarifyPrompt(key, userText),
  };
}
