"use client";

import { useRef, useState, useTransition } from "react";
import { updateFirmSettingsAction } from "@/app/admin/firms/actions";
import type { FirmBrandingJson } from "@/lib/firm-display";

type Props = {
  firmId: string;
  firmName: string;
  firmSlug: string;
  notificationEmail: string;
  disclaimerOverride: string;
  branding: FirmBrandingJson;
};

type Status = "idle" | "saving" | "saved" | "error";

export function FirmSettingsForm({
  firmId,
  firmName,
  firmSlug,
  notificationEmail,
  disclaimerOverride,
  branding: b,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setStatus("saving");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await updateFirmSettingsAction(firmId, fd);
        setStatus("saved");
      } catch (err) {
        setStatus("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Something went wrong. Please try again.",
        );
      }
    });
  }

  const saving = status === "saving";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="mt-8 max-w-xl space-y-5 rounded-lg border border-[#e2e0d9] bg-white p-6 shadow-sm"
    >
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Legal / display name (database)
        </label>
        <input
          name="name"
          required
          defaultValue={firmName}
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          URL slug (read-only)
        </label>
        <input
          readOnly
          defaultValue={firmSlug}
          className="mt-1 w-full cursor-not-allowed rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 font-mono text-sm text-[#64748b]"
        />
        <p className="mt-1 text-xs text-[#94a3b8]">Change slug via database / support if needed.</p>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Lead alert email
        </label>
        <input
          name="notificationEmail"
          type="email"
          defaultValue={notificationEmail}
          placeholder="intake@firm.com"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-[#94a3b8]">
          Primary inbox for new lead notifications. Most firms only need this field.
        </p>
      </div>

      <hr className="border-[#e2e0d9]" />
      <p className="text-sm font-medium text-[#0f172a]">Branding (shown on intake)</p>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Public display name (optional)
        </label>
        <input
          name="displayName"
          defaultValue={b.displayName ?? ""}
          placeholder={firmName}
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-[#94a3b8]">
          Leave empty to use the main firm name above. Only fill this if visitors should see a shorter
          name (e.g. &ldquo;Smith Law&rdquo; instead of the full legal name).
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Primary color (hex)
        </label>
        <input
          name="primaryColor"
          defaultValue={b.primaryColor ?? ""}
          placeholder="#1e3a5f"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Logo URL
        </label>
        <input
          name="logoUrl"
          defaultValue={b.logoUrl ?? ""}
          placeholder="https://…"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Urgent contact number
        </label>
        <input
          name="urgentPhoneDisplay"
          defaultValue={b.urgentPhoneDisplay ?? ""}
          placeholder="(555) 123-4567"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-[#94a3b8]">
          Shown to users who flag their matter as urgent. Use a readable format, e.g. (555) 123-4567.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Urgent contact number — dial link
        </label>
        <input
          name="urgentPhoneTel"
          defaultValue={b.urgentPhoneTel ?? ""}
          placeholder="+15551234567"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[#94a3b8]">
          Same number formatted for a clickable phone link. Include country code, digits only, e.g.
          +15551234567.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Greeting paragraph (optional)
        </label>
        <textarea
          name="greetingMessage"
          rows={3}
          defaultValue={b.greetingMessage ?? ""}
          placeholder="Short line shown after the thank-you line at intake start."
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Secondary alert email (optional)
        </label>
        <input
          name="contactEmail"
          type="email"
          defaultValue={b.contactEmail ?? ""}
          placeholder="Same as lead alert or different inbox"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-[#94a3b8]">
          Leave empty unless you need alerts sent to a second address in addition to the primary above.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Disclaimer override
        </label>
        <textarea
          name="disclaimerOverride"
          rows={8}
          defaultValue={disclaimerOverride}
          placeholder="Full legal notice text. If empty, default disclaimer template is used."
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#152a45] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" && (
          <p className="text-sm text-green-700">Settings saved.</p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600">{errorMsg}</p>
        )}
      </div>
    </form>
  );
}
