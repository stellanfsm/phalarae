import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAdminContext, requireFirmAccess } from "@/lib/admin-context";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
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
  const intakeUrl = `${baseUrl}/intake/${firm.slug}`;
  const embedLauncherUrl = `${baseUrl}/embed?slug=${firm.slug}`;
  const embedInlineUrl = `${baseUrl}/embed?slug=${firm.slug}&inline=1`;

  const b = parseFirmBranding(firm.branding);
  const missingAlertEmail = readiness.blockers.includes("no_notification_email");
  const missingActiveAdmin = readiness.blockers.includes("no_active_firm_admin");

  return (
    <div>
      <PageHeader
        title={firm.name}
        backHref="/admin/firms"
        backLabel="Firms"
        action={
          <Link
            href={`/admin/firms/${firm.id}/users`}
            className="text-sm text-[#475569] underline underline-offset-2 hover:text-[#0f172a]"
          >
            Manage users →
          </Link>
        }
      />
      <div className="-mt-4 mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#94a3b8]">Firm settings</span>
        <StatusBadge variant="firm" value={firm.status} />
      </div>

      {ctx.role === "operator" ? (
        <div className="mb-4 max-w-xl rounded-lg border border-[#e2e0d9] bg-[#fafaf8] px-4 py-2.5">
          <p className="text-xs text-[#475569]">
            <span className="font-semibold text-[#334155]">Operator:</span> workspace shortcuts —{" "}
            <Link href="/admin/firms" className="font-medium text-[#1e3a5f] underline underline-offset-2 hover:no-underline">
              All firms
            </Link>
            {" · "}
            <Link href="/admin/leads" className="font-medium text-[#1e3a5f] underline underline-offset-2 hover:no-underline">
              All leads
            </Link>
            {" · "}
            <Link
              href="/admin/leads?alert=failed"
              className="font-medium text-[#1e3a5f] underline underline-offset-2 hover:no-underline"
            >
              Failed delivery
            </Link>
            {" · "}
            <Link
              href="/admin/leads?alert=no_recipient"
              className="font-medium text-[#1e3a5f] underline underline-offset-2 hover:no-underline"
            >
              No recipient
            </Link>
          </p>
        </div>
      ) : null}

      <div className="mb-4 max-w-xl rounded-lg border border-[#e2e0d9] bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Go-live status</p>
        {readiness.ready ? (
          <p className="mt-1 text-sm text-emerald-700">
            {firm.status === "active"
              ? "This firm is live and setup-complete."
              : "This firm is setup-complete and ready to activate."}
          </p>
        ) : (
          <div className="mt-1 text-sm text-amber-800">
            <p>Setup is incomplete. Resolve blockers before going live:</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {missingAlertEmail ? (
                <li>
                  Set a lead alert recipient (primary lead alert email or branding Secondary alert email override).
                </li>
              ) : null}
              {missingActiveAdmin ? <li>Add at least one active firm admin.</li> : null}
            </ul>
          </div>
        )}
        {firm.status !== "active" ? (
          <p className="mt-1 text-xs text-[#64748b]">
            Public intake remains unavailable until status is set to Active.
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-[#64748b]">
        Intake:{" "}
        <a
          href={intakeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-[#475569] underline underline-offset-2 hover:text-[#0f172a]"
        >
          /intake/{firm.slug}
        </a>
        {" "}·{" "}
        Embed:{" "}
        <a
          href={embedLauncherUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-[#475569] underline underline-offset-2 hover:text-[#0f172a]"
        >
          /embed?slug={firm.slug}
        </a>
        {firm.status !== "active" && (
          <span className="ml-2 text-xs font-medium text-amber-700">
            · not live — set firm to Active first
          </span>
        )}
      </p>
      <div className="mt-2 max-w-xl rounded-md border border-[#e2e0d9] bg-white px-3 py-2">
        <p className="text-xs text-[#64748b]">
          {firm.status === "active"
            ? "Public intake and embed are live now."
            : "Public intake and embed routes exist, but they return not found until status is Active."}
        </p>
      </div>

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

      {ctx.role === "firm_staff" ? (
        <p className="mt-8 text-sm text-[#94a3b8]">
          Firm settings can only be edited by a firm admin or operator.
        </p>
      ) : (
        <FirmSettingsForm
          firmId={firm.id}
          firmName={firm.name}
          firmSlug={firm.slug}
          notificationEmail={firm.notificationEmail ?? ""}
          disclaimerOverride={firm.disclaimerOverride ?? ""}
          branding={b}
        />
      )}

      <div className="mt-8 max-w-xl rounded-lg border border-[#e2e0d9] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">Embed snippets</h2>
        <p className="mt-1 text-xs text-[#94a3b8]">
          Paste one of these into any webpage to add intake. Launcher mode uses `/embed?slug=...`; inline mode adds `&inline=1`.
        </p>
        {firm.status !== "active" ? (
          <p className="mt-2 text-xs font-medium text-amber-700">
            This firm is not active yet. Snippets are ready, but public routes will not serve until activation.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <a
            href={intakeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-[#cbd5e1] bg-[#fafaf8] px-2 py-1 text-[#475569] hover:bg-[#f1f5f9]"
          >
            Test intake route
          </a>
          <a
            href={embedLauncherUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-[#cbd5e1] bg-[#fafaf8] px-2 py-1 text-[#475569] hover:bg-[#f1f5f9]"
          >
            Test embed launcher route
          </a>
          <a
            href={embedInlineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-[#cbd5e1] bg-[#fafaf8] px-2 py-1 text-[#475569] hover:bg-[#f1f5f9]"
          >
            Test embed inline route
          </a>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-[#475569]">Floating launcher (chat bubble)</p>
            <p className="mt-0.5 text-xs text-[#94a3b8]">Default embed mode. Shows launcher first, then opens chat panel inside the iframe.</p>
            <div className="mt-2 flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed text-[#e2e8f0]">{`<iframe
  src="${embedLauncherUrl}"
  style="position:fixed;bottom:24px;right:24px;width:min(420px,100vw);height:min(600px,100vh);border:none;z-index:9999;"
  title="Contact us"
></iframe>`}</pre>
              <CopyButton text={`<iframe\n  src="${embedLauncherUrl}"\n  style="position:fixed;bottom:24px;right:24px;width:min(420px,100vw);height:min(600px,100vh);border:none;z-index:9999;"\n  title="Contact us"\n></iframe>`} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#475569]">Inline block (embedded in page)</p>
            <p className="mt-0.5 text-xs text-[#94a3b8]">Renders as a fixed-height block inside your page layout.</p>
            <div className="mt-2 flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md bg-[#0f172a] p-3 font-mono text-[11px] leading-relaxed text-[#e2e8f0]">{`<iframe
  src="${embedInlineUrl}"
  width="100%"
  height="640"
  style="border:none;"
  title="Contact us"
></iframe>`}</pre>
              <CopyButton text={`<iframe\n  src="${embedInlineUrl}"\n  width="100%"\n  height="640"\n  style="border:none;"\n  title="Contact us"\n></iframe>`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
