/**
 * Active demo / law-firm customization (single file — edit per prospect).
 *
 * How to use:
 * 1. Update the fields below (name, logo, color, emails, phone, legal copy).
 * 2. Keep `intakeSlug` equal to the URL segment and your Prisma Firm.slug
 *    (seed default is `demo` in prisma/seed.ts). Change the seed if you rename the slug.
 * 3. Restart the dev server or redeploy so changes load.
 *
 * MVP: Only this slug uses this config for branding + copy + lead email routing.
 * Other Firm rows in the DB keep using DB fields only.
 */

export type FirmDemoConfig = {
  /** Must match /intake/[slug] and Firm.slug in the database */
  intakeSlug: string;
  /** Shown in header, completion message, and emails */
  firmName: string;
  /** Optional; leave "" to hide */
  logoUrl: string;
  /** Hex for buttons and accents */
  primaryColor: string;
  /** Where new-lead alerts are sent when this slug is active (overrides Firm.notificationEmail first) */
  contactEmail: string;
  /** Full legal notice (shown in panel + 2nd assistant message on start) */
  disclaimerText: string;
  /** Shown after the opening line; required disclaimers are appended by the server in message 1 */
  greetingMessage: string;
  /** Display label, e.g. "(555) 123-4567" */
  urgentPhoneDisplay: string;
  /** For tel: links — digits and + only, e.g. +15551234567 */
  urgentPhoneTel: string;
};

export const firmDemoConfig: FirmDemoConfig = {
  intakeSlug: "demo",
  firmName: "",
  logoUrl: "https://www.sewelllawfirm.com/wp-content/themes/sewelllawfirm/images/logo.webp",
  primaryColor: "#9E1D20",
  contactEmail: "intake@sewelllaw.com",
  disclaimerText: [
    "Important legal notice",
    "",
    "• I am an automated intake assistant, not a lawyer. I cannot provide legal advice.",
    "• Nothing we discuss creates an attorney–client relationship. A licensed attorney must evaluate your matter.",
    "• If you are having a medical or safety emergency, hang up and call 911 (or your local emergency number) immediately.",
    "",
    "By continuing, you confirm you understand this notice.",
  ].join("\n"),
  greetingMessage:
    "I’ll ask a short series of questions so our team can follow up with you. Please answer as best you can.",
  urgentPhoneDisplay: "(555) 123-4567",
  urgentPhoneTel: "+15551234567",
};

export function getFirmConfigForSlug(slug: string): FirmDemoConfig | null {
  if (slug === firmDemoConfig.intakeSlug) return firmDemoConfig;
  return null;
}
