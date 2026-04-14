import type { FlowStepKey } from "@/lib/intake-steps";
import { validateFieldKey } from "@/lib/intake-parse-field";

/** Values coerced so Zod still passes after max clarification rounds (flagged for staff review). */
export function buildForceAcceptedValue(key: FlowStepKey, raw: string): unknown {
  const t = raw.trim().slice(0, 8000);
  switch (key) {
    case "description": {
      if (t.length >= 10) return t;
      const p = `[Needs staff review] ${t}`;
      return p.length >= 10 ? p : `${p} ………`.slice(0, 12);
    }
    case "incidentDate": {
      const v = t.slice(0, 64) || "see notes";
      return v.length >= 4 ? v : "see notes";
    }
    case "incidentLocation": {
      const v = t.slice(0, 200) || "see notes";
      return v.length >= 2 ? v : "see notes";
    }
    case "fullName": {
      if (t.length >= 2) return t.slice(0, 200);
      return `Review: ${t || "name"}`.slice(0, 200);
    }
    case "injuries":
    case "medicalTreatment":
    case "otherPartyFault":
    case "policeReport":
    case "hasAttorney":
    case "urgent":
      return "unclear";
    case "incidentType":
      return "other";
    case "motorVehicleInvolvement":
      return "unclear";
    case "preferredContact":
      return "either";
    default:
      return t;
  }
}

export function isForceAcceptValueValid(key: FlowStepKey, value: unknown): boolean {
  return validateFieldKey(key, value);
}
