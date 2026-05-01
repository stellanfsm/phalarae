import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/admin-context";
import { computeFirmReadiness } from "@/lib/firm-readiness";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

export default async function AdminFirmsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  const firms = await prisma.firm.findMany({
    where: ctx.firmId ? { id: ctx.firmId } : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      notificationEmail: true,
      branding: true,
      status: true,
      adminUsers: {
        where: { deactivatedAt: null, role: "firm_admin" },
        select: { id: true },
        take: 1,
      },
    },
  });

  const isPlatformOperator = ctx.role === "operator" && ctx.firmId === null;
  const activeFirmsCount = firms.filter((f) => f.status === "active").length;
  const setupBlockedCount = firms.filter((f) => {
    const r = computeFirmReadiness(f, f.adminUsers.length);
    return !r.ready;
  }).length;

  let platformFailedAlerts = 0;
  let platformNoRecipientAlerts = 0;
  if (isPlatformOperator) {
    [platformFailedAlerts, platformNoRecipientAlerts] = await Promise.all([
      prisma.lead.count({ where: { alertStatus: "failed" } }),
      prisma.lead.count({ where: { alertStatus: "no_recipient" } }),
    ]);
  }
  const platformDeliveryIssues = platformFailedAlerts + platformNoRecipientAlerts;

  return (
    <div>
      <PageHeader
        title="Firms"
        subtitle="Branding and contact settings for each firm. The intake URL, embed code, and copyable widget snippet are available on each firm’s settings page."
        action={
          ctx.role === "operator" ? (
            <Link
              href="/admin/firms/new"
              className="rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#152a45]"
            >
              + New firm
            </Link>
          ) : undefined
        }
      />

      {isPlatformOperator ? (
        <div className="mt-6 rounded-lg border border-[#e2e0d9] bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Operator snapshot</p>
          {firms.length === 0 ? (
            <p className="mt-2 text-sm text-[#334155]">No firms configured yet. Create a firm to start onboarding.</p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-[#334155]">
              <span className="font-medium text-[#0f172a]">{firms.length}</span> firm
              {firms.length === 1 ? "" : "s"} in the workspace:{" "}
              <span className="font-medium text-[#0f172a]">{activeFirmsCount}</span> active
              {setupBlockedCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-amber-800">{setupBlockedCount}</span> with incomplete setup (lead alert
                  recipient or active firm admin)
                </>
              ) : (
                <> · all listed firms pass setup checks</>
              )}
              .{" "}
              {platformDeliveryIssues > 0 ? (
                <>
                  Across all leads,{" "}
                  <span className="font-medium text-amber-900">{platformDeliveryIssues}</span> lead
                  {platformDeliveryIssues === 1 ? "" : "s"} with lead alert delivery issues (
                  <span className="font-medium">{platformFailedAlerts}</span> failed,{" "}
                  <span className="font-medium">{platformNoRecipientAlerts}</span> no recipient).
                </>
              ) : (
                <>No leads are currently in Failed or No recipient lead alert states.</>
              )}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#1e3a5f]">
            <Link href="/admin/leads" className="underline underline-offset-2 hover:no-underline">
              All leads
            </Link>
            <Link href="/admin/leads?status=new" className="underline underline-offset-2 hover:no-underline">
              New queue
            </Link>
            <Link href="/admin/leads?alert=failed" className="underline underline-offset-2 hover:no-underline">
              Failed delivery
            </Link>
            <Link href="/admin/leads?alert=no_recipient" className="underline underline-offset-2 hover:no-underline">
              No recipient
            </Link>
          </div>
        </div>
      ) : null}

      <ul className="mt-8 divide-y divide-[#e2e0d9] rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
        {firms.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-[#0f172a]">{f.name}</p>
                <StatusBadge variant="firm" value={f.status} />
              </div>
              <p className="text-sm text-[#64748b]">
                Slug: <span className="font-mono text-xs">{f.slug}</span>
                {f.notificationEmail ? (
                  <>
                    {" "}
                    · Lead alert: <span className="text-[#475569]">{f.notificationEmail}</span>
                  </>
                ) : null}
              </p>
              {(() => {
                const r = computeFirmReadiness(f, f.adminUsers.length);
                if (r.ready && f.status === "active") {
                  return <p className="mt-0.5 text-xs text-emerald-700">Live and fully configured</p>;
                }
                if (r.ready) {
                  return (
                    <p className="mt-0.5 text-xs text-emerald-700">
                      Ready to activate
                      {ctx.role === "operator" ? " — switch status to Active" : ""}
                    </p>
                  );
                }
                const missingAlert = r.blockers.includes("no_notification_email");
                const missingAdmin = r.blockers.includes("no_active_firm_admin");
                return (
                  <p className="mt-0.5 text-xs text-amber-700">
                    Setup blocked:{" "}
                    {[
                      missingAlert ? "lead alert recipient missing" : null,
                      missingAdmin ? "no active firm admin" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                );
              })()}
            </div>
            <Link
              href={`/admin/firms/${f.id}`}
              className="rounded-lg border border-[#cbd5e1] bg-[#fafaf8] px-3 py-1.5 text-sm font-medium text-[#334155] hover:bg-[#f1f5f9]"
            >
              Edit settings
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
