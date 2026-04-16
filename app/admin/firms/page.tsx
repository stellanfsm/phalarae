import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminContext } from "@/lib/admin-context";
import { computeFirmReadiness } from "@/lib/firm-readiness";

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-inset ring-emerald-200">
        Active
      </span>
    );
  if (status === "inactive")
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
        Inactive
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
      Pending setup
    </span>
  );
}

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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">Firms</h1>
        {ctx.role === "operator" && (
          <Link
            href="/admin/firms/new"
            className="rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#152a45]"
          >
            + New firm
          </Link>
        )}
      </div>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#64748b]">
        Branding and contact settings for each firm. The intake URL, embed code, and copyable widget snippet are available on each firm's settings page.
      </p>

      <ul className="mt-8 divide-y divide-[#e2e0d9] rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
        {firms.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-[#0f172a]">{f.name}</p>
                <StatusBadge status={f.status} />
              </div>
              <p className="text-sm text-[#64748b]">
                Slug: <span className="font-mono text-xs">{f.slug}</span>
                {f.notificationEmail ? (
                  <>
                    {" "}
                    · Alerts: <span className="text-[#475569]">{f.notificationEmail}</span>
                  </>
                ) : null}
              </p>
              {ctx.role === "operator" && (() => {
                const r = computeFirmReadiness(f, f.adminUsers.length);
                if (r.ready && f.status === "active") return null;
                if (r.ready)
                  return (
                    <p className="mt-0.5 text-xs text-emerald-700">Ready to activate</p>
                  );
                return (
                  <p className="mt-0.5 text-xs text-amber-700">
                    {r.blockers.length} setup item{r.blockers.length > 1 ? "s" : ""} missing
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
