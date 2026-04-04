import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intake",
  description: "Secure case intake chat",
  robots: { index: false, follow: false },
};

/**
 * Minimal chrome for iframe embedding: fills the iframe document and scopes layout.
 * Styles stay inside this document — they do not affect the parent site.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="phalerae-embed-root fixed inset-0 isolate overflow-hidden bg-transparent">
      <div className="h-full min-h-0 w-full bg-transparent">{children}</div>
    </div>
  );
}
