/**
 * Full-page intake shell (no floating launcher).
 *
 * - **Website widget with floating button:** use route **`/embed`** → [`IntakeEmbedWidget`](./IntakeEmbedWidget.tsx).
 * - **Full-page in an iframe:** use `/intake/[slug]` with this component.
 */

import { IntakeClient } from "@/components/intake/IntakeClient";

export type IntakeWidgetProps = {
  firmSlug: string;
  firmDisplayName: string;
  primaryColor: string;
  disclaimerText: string;
  logoUrl: string;
  urgentPhoneDisplay: string;
  urgentPhoneTel: string;
};

export function IntakeWidget({
  firmSlug,
  firmDisplayName,
  primaryColor,
  disclaimerText,
  logoUrl,
  urgentPhoneDisplay,
  urgentPhoneTel,
}: IntakeWidgetProps) {
  return (
    <div className="min-h-screen bg-[#f4f3ef] px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-lg">
        <IntakeClient
          firmSlug={firmSlug}
          firmDisplayName={firmDisplayName}
          primaryColor={primaryColor}
          disclaimerText={disclaimerText}
          logoUrl={logoUrl}
          urgentPhoneDisplay={urgentPhoneDisplay}
          urgentPhoneTel={urgentPhoneTel}
        />
        <p className="mt-6 text-center text-[11px] leading-relaxed tracking-wide text-[#94a3b8]">
          Powered by Phalerae · Not a law firm · No attorney–client relationship
        </p>
      </div>
    </div>
  );
}
