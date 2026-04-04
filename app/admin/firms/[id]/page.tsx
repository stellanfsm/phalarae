import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminOperator } from "@/lib/admin-operator";
import { parseFirmBranding } from "@/lib/firm-display";
import { updateFirmSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminFirmEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const op = await getAdminOperator();
  if (!op) redirect("/admin/login");
  if (op.user.firmId != null && op.user.firmId !== id) notFound();

  const firm = await prisma.firm.findUnique({ where: { id } });
  if (!firm) notFound();

  const b = parseFirmBranding(firm.branding);
  const boundUpdate = updateFirmSettingsAction.bind(null, firm.id);

  return (
    <div>
      <p className="text-sm text-[#64748b]">
        <Link href="/admin/firms" className="text-[#0f172a] underline hover:no-underline">
          ← Firms
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-2xl font-semibold text-[#0f172a]">Edit firm</h1>
      <p className="mt-1 text-sm text-[#64748b]">
        Intake URL:{" "}
        <span className="font-mono text-xs text-[#475569]">/intake/{firm.slug}</span> · Embed:{" "}
        <span className="font-mono text-xs text-[#475569]">/embed?slug={firm.slug}</span>
      </p>

      <form action={boundUpdate} className="mt-8 max-w-xl space-y-5 rounded-lg border border-[#e2e0d9] bg-white p-6 shadow-sm">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
            Legal / display name (database)
          </label>
          <input
            name="name"
            required
            defaultValue={firm.name}
            className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
            URL slug (read-only)
          </label>
          <input
            readOnly
            value={firm.slug}
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
            defaultValue={firm.notificationEmail ?? ""}
            placeholder="intake@firm.com"
            className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-[#94a3b8]">
            Falls back to <code className="font-mono">LEAD_ALERT_EMAIL</code> in .env if empty.
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
            placeholder={firm.name}
            className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
          />
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
            Urgent phone (display)
          </label>
          <input
            name="urgentPhoneDisplay"
            defaultValue={b.urgentPhoneDisplay ?? ""}
            placeholder="(555) 123-4567"
            className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
            Urgent phone (tel link, + and digits)
          </label>
          <input
            name="urgentPhoneTel"
            defaultValue={b.urgentPhoneTel ?? ""}
            placeholder="+15551234567"
            className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 font-mono text-sm"
          />
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
            Alert email override (optional)
          </label>
          <input
            name="contactEmail"
            type="email"
            defaultValue={b.contactEmail ?? ""}
            placeholder="Same as lead alert or different inbox"
            className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-[#94a3b8]">
            Used if <code className="font-mono">config/firm.ts</code> does not set contact email for this slug.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
            Disclaimer override
          </label>
          <textarea
            name="disclaimerOverride"
            rows={8}
            defaultValue={firm.disclaimerOverride ?? ""}
            placeholder="Full legal notice text. If empty, default disclaimer template is used."
            className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#152a45]"
        >
          Save settings
        </button>
      </form>
    </div>
  );
}
