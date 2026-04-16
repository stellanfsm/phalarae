import type { FlowStepKey } from "@/lib/intake-steps";
import {
  isValidEmailFormat,
  normalizeEmailText,
  normalizeIncidentTypeDetailed,
  normalizeMotorInvolvement,
  normalizePhoneDigits,
  normalizeTriState,
} from "@/lib/intake-normalize";
import { intakePayloadLooseSchema, motorVehicleInvolvementSchema } from "@/lib/schemas/intake-data";

const fieldShapes = intakePayloadLooseSchema.shape;

export type ParsedFieldUpdate = {
  key: FlowStepKey;
  value: unknown;
  confidence: number;
};

export function validateFieldKey(key: FlowStepKey, value: unknown): boolean {
  if (key === "motorVehicleInvolvement") {
    return motorVehicleInvolvementSchema.safeParse(value).success;
  }
  try {
    fieldShapes[key].parse(value);
    return true;
  } catch {
    return false;
  }
}

export function parseFieldValueForKey(key: FlowStepKey, raw: string): unknown {
  const t = raw.trim();
  switch (key) {
    case "email": {
      const { normalized } = normalizeEmailText(t);
      return isValidEmailFormat(normalized) ? normalized : null;
    }
    case "phone":
      return normalizePhoneDigits(t);
    case "incidentType": {
      if (t.length < 2) return null;
      const r = normalizeIncidentTypeDetailed(t);
      return r.confidence >= 0.5 ? r.value : null;
    }
    case "motorVehicleInvolvement":
      return normalizeMotorInvolvement(t) ?? null;
    case "injuries":
    case "medicalTreatment":
    case "otherPartyFault":
    case "policeReport":
    case "hasAttorney":
    case "urgent":
      return normalizeTriState(t);
    default:
      return t;
  }
}
