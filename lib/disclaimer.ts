/** Default disclaimer shown at intake start; firms can override via `Firm.disclaimerOverride`. */
export const DEFAULT_DISCLAIMER_PARAGRAPHS = [
  "I am an automated intake assistant, not a lawyer. I cannot provide legal advice.",
  "Nothing we discuss creates an attorney–client relationship. A licensed attorney must evaluate your matter.",
  "If you are having a medical or safety emergency, hang up and call 911 (or your local emergency number) immediately.",
] as const;

export function formatDisclaimerBlock(override?: string | null): string {
  if (override?.trim()) return override.trim();
  return [
    "Important legal notice",
    "",
    ...DEFAULT_DISCLAIMER_PARAGRAPHS.map((p) => `• ${p}`),
    "",
    "By continuing, you confirm you understand this notice.",
  ].join("\n");
}
