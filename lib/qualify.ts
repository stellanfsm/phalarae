import type { IntakePayload, QualificationTag } from "@/lib/schemas/intake-data";

/**
 * Rules-only qualification — not a legal judgment. Edit the branches below to tune routing.
 *
 * Definitions (MVP):
 * - likely_relevant: (injury yes OR medical treatment yes) AND (fault yes OR unclear) AND no attorney.
 * - low_relevance: (no injury AND no treatment) OR already has attorney.
 * - needs_review: everything else (mixed / unclear signals).
 *
 * Note: When the user has no injury and no treatment, intake still completes; routing biases low_relevance.
 * When they already have an attorney, urgency is not asked (stored as no); routing is low_relevance.
 */
export function qualifyIntake(
  data: IntakePayload,
  opts?: { qualityRequiresReview?: boolean },
): QualificationTag {
  if (opts?.qualityRequiresReview) return "needs_review";

  const hasAttyYes = data.hasAttorney === "yes";
  const injYes = data.injuries === "yes";
  const injNo = data.injuries === "no";
  const medYes = data.medicalTreatment === "yes";
  const medNo = data.medicalTreatment === "no";
  const faultYes = data.otherPartyFault === "yes";
  const faultUnclear = data.otherPartyFault === "unclear";

  if (hasAttyYes) return "low_relevance";

  if (injNo && medNo) return "low_relevance";

  const injurySignal = injYes || medYes;
  const faultOk = faultYes || faultUnclear;

  if (injurySignal && faultOk) return "likely_relevant";

  return "needs_review";
}
