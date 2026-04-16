import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAdminContext, requireFirmAccess } from "@/lib/admin-context";
import { parseFirmBranding } from "@/lib/firm-display";
import { CopyButton } from "@/components/admin/CopyButton";
import { FirmSettingsForm } from "@/components/admin/FirmSettingsForm";
import { FirmStatusControl } from "@/components/admin/FirmStatusControl";
import { FirmReadinessPanel } from "@/components/admin/FirmReadinessPanel";
import { computeFirmReadiness } from "@/lib/firm-readiness";

export const dynamic = "force-dynamic";

export default async function AdminFirmEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  requireFirmAccess(ctx, id);

  const [firm, activeFirmAdminCount] = await Promise.all([
    prisma.firm.findUnique({ where: { id } }),
    prisma.adminUser.count({
      where: { firmId: id, role: "firm_admin", deactivatedAt: null },
    }),
  ]);
  if (!firm) notFound();

  const readiness = computeFirmReadiness(firm, activeFirmAdminCount);

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("host") ?? "YOUR_DOMAIN";
  const baseUrl = `${proto}://${host}`;

  const b = parseFirmBranding(firm.branding);

  return (
    <div>
      <p className="text-sm text-[#64748b]">
        <Link href="/admin/firms" className="text-[#0f172a] underline hover:no-underline">
          ← Firms
        </Link>
      </p>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">{firm.name}</h1>
        <Link
          href={`/admin/firms/${firm.id}/users`}
          className="shrink-0 text-sm text-[#475569] underline underline-offset-2 hover:text-[#0f172a]"
        >
          Manage users →
        </Link>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-3">
        <span className="text-xs text-[#94a3b8]">Firm settings</span>
        {firm.status === "active" ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-inset ring-emerald-200">Active</span>
        ) : firm.status === "inactive" ? (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">Inactive</span>
        ) : (
          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Pending setup</span>
        )}
      </div>
      <p className="mt-2 text-sm text-[#64748b]">
        Intake:{" "}
        <a
          href={`${baseUrl}/intake/${firm.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-[#475569] underline underline-offset-2 hover:text-[#0f172a]"
        >
          /intake/{firm.slug}
        </a>
        {" "}·{" "}
        Embed:{" "}
        <a
          href={`${baseUrl}/embed?slug=${firm.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-[#475569] underline underline-offset-2 hover:text-[#0f172a]"
        >
          /embed?slug={firm.slug}
        </a>
      </p>

      {ctx.role === "operator" && (
        <div className="mt-6 max-w-xl">
          <FirmStatusControl
            firmId={firm.id}
            currentStatus={firm.status as "pending" | "active" | "inactive"}
            readiness={readiness}
          />
        </div>
      )}

      <FirmReadinessPanel firmId={firm.id} readiness={readiness} firmStatus={firm.status} />

      <FirmSettingsForm
        firmId={firm.id}
        firmName={firm.name}
        firmSlug={firm.slug}
        notificationEmail={firm.notificationEmail ?? ""}
        disclaimerOverride={firm.disclaimerOverride ?? ""}
        branding={b}
      />

      <div className="mt-8 max-w-xl rounded-lg border border-[#e2e0d9] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">Embed snippets</h2>
        <p className="mt-1 text-xs text-[#94a3b8]">
          Paste one of these into any webpage to add the intake widget.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-[#475569]">Floating launcher (chat bubble)</p>
            <p className="mt-0.5 text-xs text-[#94a3b8]">Appears as a button in the corner of your page.</p>
            <div className="mt-2 flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed text-[#e2e8f0]">{`<iframe
  src="${baseUrl}/embed?slug=${firm.slug}"
  style="position:fixed;bottom:24px;right:24px;width:min(420px,100vw);height:min(600px,100vh);border:none;z-index:9999;"
  title="Contact us"
></iframe>`}</pre>
              <CopyButton text={`<iframe\n  src="${baseUrl}/embed?slug=${firm.slug}"\n  style="position:fixed;bottom:24px;right:24px;width:min(420px,100vw);height:min(600px,100vh);border:none;z-index:9999;"\n  title="Contact us"\n></iframe>`} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#475569]">Inline block (embedded in page)</p>
            <p className="mt-0.5 text-xs text-[#94a3b8]">Renders as a fixed-height block inside your page layout.</p>
            <div className="mt-2 flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed text-[#e2e8f0]">{`<iframe
  src="${baseUrl}/embed?slug=${firm.slug}&inline=1"
  width="100%"
  height="640"
  style="border:none;"
  title="Contact us"
></iframe>`}</pre>
              <CopyButton text={`<iframe\n  src="${baseUrl}/embed?slug=${firm.slug}&inline=1"\n  width="100%"\n  height="640"\n  style="border:none;"\n  title="Contact us"\n></iframe>`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
