import { applyIntakeDefaults, allMissingFields, type FlowStepKey } from "@/lib/intake-steps";
import { normalizeIncidentTypeDetailed } from "@/lib/intake-normalize";
import type { IntakePayload } from "@/lib/schemas/intake-data";
import {
  parseFieldValueForKey,
  validateFieldKey,
  type ParsedFieldUpdate,
} from "@/lib/intake-parse-field";

export type { ParsedFieldUpdate };

export function confidenceThresholdForField(key: FlowStepKey): number {
  switch (key) {
    case "incidentType":
      return 0.56;
    case "description":
      return 0.45;
    case "incidentDate":
    case "incidentLocation":
    case "fullName":
      return 0.5;
    case "email":
    case "phone":
      return 0.62;
    case "injuries":
    case "medicalTreatment":
    case "otherPartyFault":
    case "policeReport":
    case "hasAttorney":
    case "urgent":
      return 0.52;
    case "motorVehicleInvolvement":
      return 0.55;
    default:
      return 0.55;
  }
}

export function segmentUserMessage(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const parts = t
    .split(/\n+|(?:\s+•\s+)|(?:\s*[/|]\s*)|(?:\s+—\s+)|(?:\s{2,})/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([t, ...parts])];
}

/**
 * Deterministic multi-field scan: tries full message and segments against missing fields from active step onward.
 */
export function extractDeterministicMultiField(
  activeKey: FlowStepKey,
  userText: string,
  partial: Partial<IntakePayload>,
): ParsedFieldUpdate[] {
  const d0 = applyIntakeDefaults(partial);
  const missing = allMissingFields(d0);
  const start = missing.indexOf(activeKey);
  const slice = start >= 0 ? missing.slice(start) : missing;
  if (slice.length === 0) return [];

  const segments = segmentUserMessage(userText);
  const candidates: ParsedFieldUpdate[] = [];

  for (const key of slice) {
    const thresh = confidenceThresholdForField(key);
    let best: ParsedFieldUpdate | null = null;

    const consider = (segment: string, conf: number) => {
      const v = parseFieldValueForKey(key, segment);
      if (v === null || !validateFieldKey(key, v)) return;
      if (conf < thresh) return;
      if (!best || conf > best.confidence) best = { key, value: v, confidence: conf };
    };

    if (key === "description") {
      for (const seg of segments) {
        const v = seg.trim();
        if (v.length < 8) continue;
        if (!validateFieldKey("description", v)) continue;
        const conf = Math.min(0.95, 0.42 + Math.min(v.length, 200) / 350);
        consider(seg, conf);
      }
    } else {
      for (const seg of segments) {
        const v = parseFieldValueForKey(key, seg);
        if (v === null || !validateFieldKey(key, v)) continue;
        let conf = 0.82;
        if (key === "incidentType") conf = normalizeIncidentTypeDetailed(seg).confidence;
        if (seg.length < 90) conf = Math.max(conf, 0.78);
        consider(seg, conf);
      }
      const fv = parseFieldValueForKey(key, userText);
      if (fv !== null && validateFieldKey(key, fv)) {
        let conf = 0.85;
        if (key === "incidentType") conf = normalizeIncidentTypeDetailed(userText).confidence;
        consider(userText, conf);
      }
    }

    if (best) candidates.push(best);
  }

  return candidates;
}
