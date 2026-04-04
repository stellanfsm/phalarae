import { z } from "zod";
import { incidentTypeSchema, preferredContactSchema, triStateSchema } from "@/lib/schemas/intake-data";

export type TriState = z.infer<typeof triStateSchema>;
export type PreferredContact = z.infer<typeof preferredContactSchema>;
export type IncidentTypeEnum = z.infer<typeof incidentTypeSchema>;

const emailCheck = z.string().email();

/**
 * Maps messy free text to yes | no | unclear (stored as "unclear" for not-sure style answers).
 * "I think so" → unclear per product spec (ambiguous / hedged).
 */
export function normalizeTriState(raw: string): TriState | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  const collapsed = s.replace(/[^a-z]/g, "");

  const unclearHints =
    /\b(not\s*sure|unsure|don'?t\s*know|do\s*not\s*know|idk|dunno|maybe|perhaps|unclear|unknown|no\s*idea|not\s*certain|hard\s*to\s*say|i\s*think\s*so|i\s*guess|sort\s*of|kinda|kind\s*of)\b/.test(
      s,
    ) ||
    collapsed === "notsure" ||
    collapsed === "notusre" ||
    collapsed === "unsyre" ||
    collapsed === "idk";

  if (unclearHints) return "unclear";

  const t = raw.trim();
  if (/^\s*n\s*$/i.test(t)) return "no";
  if (/^\s*y\s*$/i.test(t)) return "yes";

  if (
    /^(n|no|nope|nah|negative|never|not\s*really)\b/.test(s) ||
    collapsed === "noo" ||
    collapsed === "na"
  ) {
    return "no";
  }

  if (
    /^(y|yes|yeah|yep|yup|sure|yess|correct|definitely|absolutely|indeed|affirmative|right|exactly)\b/.test(
      s,
    ) ||
    collapsed === "yse"
  ) {
    return "yes";
  }

  return null;
}

/** preferred contact: email | phone | either — "both" maps to either */
export function normalizePreferredContact(raw: string): PreferredContact | null {
  const s = raw.trim().toLowerCase();
  const c = s.replace(/[^a-z]/g, "");

  if (
    c.includes("either") ||
    c.includes("both") ||
    /\bany\s*(is\s*fine|works)\b/.test(s) ||
    (s.includes("email") && s.includes("phone"))
  ) {
    return "either";
  }
  if (/\b(email|e-?mail)\b/.test(s) || c === "emial" || c === "emai") return "email";
  if (/\b(phone|call|text|mobile|cell)\b/.test(s) || c.includes("phon") || c === "phoen") {
    return "phone";
  }

  return null;
}

export type MotorInvolvement = "multi_vehicle" | "single_vehicle" | "unclear";

export function normalizeMotorInvolvement(raw: string): MotorInvolvement | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  if (
    /\b(not\s*sure|unsure|idk|maybe|don'?t\s*know|no\s*idea)\b/.test(s) ||
    s.replace(/[^a-z]/g, "") === "notsure" ||
    s.replace(/[^a-z]/g, "") === "notusre"
  ) {
    return "unclear";
  }

  const c = s.replace(/[^a-z]/g, "");
  if (
    /\b(multi|multiple|two|2|three|3|several|pile|chain)\b/.test(s) ||
    c.includes("multivehicle")
  ) {
    return "multi_vehicle";
  }
  if (
    /\b(single|one\s*vehicle|one\s*car|solo)\b/.test(s) ||
    c.includes("singlevehicle")
  ) {
    return "single_vehicle";
  }

  return null;
}

/** Digits only; strips country code 1; 10–15 digit core */
export function normalizePhoneDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

/** Human hint when digits are close but invalid */
export function phoneFormatHint(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length === 0) return null;
  if (d.length < 10) return `That looks like only ${d.length} digits — include area code (10 digits).`;
  if (d.length > 15) return "That number has too many digits. Please enter a standard U.S. number with area code.";
  return null;
}

export function isValidEmailFormat(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return emailCheck.safeParse(t).success;
}

/** Common obfuscations + light typo fixes before validation */
export function normalizeEmailText(raw: string): { normalized: string; hadCorrections: boolean } {
  let s = raw.trim();
  let had = false;
  if (/\[at\]|\(at\)|\s+at\s+|\s+@\s*at\s+/i.test(s)) {
    s = s.replace(/\s*\[at\]\s*/gi, "@").replace(/\s*\(at\)\s*/gi, "@").replace(/\s+at\s+/gi, "@");
    had = true;
  }
  if (/\[dot\]|\(dot\)/i.test(s)) {
    s = s.replace(/\s*\[dot\]\s*/gi, ".").replace(/\s*\(dot\)\s*/gi, ".");
    had = true;
  }
  s = s.replace(/\s+/g, "").toLowerCase();
  const fixes: [RegExp, string][] = [
    [/gmial\.com$/i, "gmail.com"],
    [/gmai\.com$/i, "gmail.com"],
    [/yahooo\./i, "yahoo."],
    [/hotmial\./i, "hotmail."],
    [/outlok\./i, "outlook."],
  ];
  for (const [re, rep] of fixes) {
    if (re.test(s)) {
      s = s.replace(re, rep);
      had = true;
    }
  }
  return { normalized: s, hadCorrections: had };
}

export type IncidentTypeResult = {
  value: IncidentTypeEnum;
  confidence: number;
};

/**
 * Fuzzy keyword → enum; caller stores raw user text separately for admin.
 */
export function normalizeIncidentTypeDetailed(raw: string): IncidentTypeResult {
  const original = raw.trim();
  const lower = original.toLowerCase();

  const rules: { re: RegExp; value: IncidentTypeEnum; confidence: number }[] = [
    { re: /\b(hit by (a |the )?car|car hit|run over|rear[-\s]?end|mva\b|motor\s*vehicle|auto accident|truck hit|bike vs car|cyclist hit)\b/i, value: "motor_vehicle", confidence: 0.92 },
    { re: /\b(car crash|vehicle crash|collision|totaled|intersection crash)\b/i, value: "motor_vehicle", confidence: 0.88 },
    { re: /\b(dog bite|bitten by dog|k9|canine attack)\b/i, value: "dog_bite", confidence: 0.9 },
    { re: /\b(slip|trip|fell|fallen|fell on|wet floor|stairs)\b/i, value: "slip_fall", confidence: 0.85 },
    { re: /\b(workers?\s*comp|on the job|workplace|employer|osha)\b/i, value: "workplace", confidence: 0.85 },
    { re: /\b(medical malpractice|surgery (error|mistake)|misdiagnosis|hospital negligence)\b/i, value: "medical_malpractice", confidence: 0.88 },
    { re: /\b(assault|attacked|mugged|shot|stabbed|battery)\b/i, value: "other", confidence: 0.72 },
    { re: /\b(motor|car|vehicle|auto|driving)\b/i, value: "motor_vehicle", confidence: 0.7 },
    { re: /\b(slip|trip|fall)\b/i, value: "slip_fall", confidence: 0.68 },
    { re: /\b(work|job|employment)\b/i, value: "workplace", confidence: 0.65 },
    { re: /\b(medical|malpractice|doctor|hospital)\b/i, value: "medical_malpractice", confidence: 0.65 },
    { re: /\b(dog)\b/i, value: "dog_bite", confidence: 0.65 },
  ];

  for (const { re, value, confidence } of rules) {
    if (re.test(lower)) return { value, confidence };
  }

  return { value: "other", confidence: 0.55 };
}
