import { z } from "zod";

export const preferredContactSchema = z.enum(["email", "phone", "either"]);

export const incidentTypeSchema = z.enum([
  "motor_vehicle",
  "slip_fall",
  "workplace",
  "medical_malpractice",
  "dog_bite",
  "other",
]);

/** Tri-state yes/no/unclear for qualification without pretending legal certainty */
export const triStateSchema = z.enum(["yes", "no", "unclear"]);

export const motorVehicleInvolvementSchema = z.enum([
  "multi_vehicle",
  "single_vehicle",
  "unclear",
]);

/** Same shape without motor refine — for reading older stored leads in admin. */
export const intakePayloadLooseSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  phone: z.string().min(7).max(40),
  preferredContact: preferredContactSchema.default("either"),
  incidentDate: z.string().min(4).max(64),
  incidentLocation: z.string().min(2).max(200),
  incidentType: incidentTypeSchema,
  /** Original user wording for incident category (when different from normalized enum). */
  incidentTypeUserText: z.string().max(500).optional(),
  motorVehicleInvolvement: motorVehicleInvolvementSchema.optional(),
  description: z.string().min(10).max(8000),
  injuries: triStateSchema,
  medicalTreatment: triStateSchema,
  otherPartyFault: triStateSchema,
  policeReport: triStateSchema,
  hasAttorney: triStateSchema,
  urgent: triStateSchema,
});

export const intakePayloadSchema = intakePayloadLooseSchema.refine(
  (d) => d.incidentType !== "motor_vehicle" || d.motorVehicleInvolvement != null,
  { path: ["motorVehicleInvolvement"], message: "Motor vehicle involvement detail required" },
);

export type IntakePayload = z.infer<typeof intakePayloadSchema>;
export type QualificationTag = "likely_relevant" | "needs_review" | "low_relevance";
