import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminOperator } from "@/lib/admin-operator";

export const dynamic = "force-dynamic";

export default async function AdminFirmsPage() {
  const op = await getAdminOperator();
  if (!op) redirect("/admin/login");

  const firms = await prisma.firm.findMany({
    where: op.user.firmId ? { id: op.user.firmId } : undefined,
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, notificationEmail: true },
  });

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">Firms</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#64748b]">
        Branding and contact settings for intake. Slug is used in{" "}
        <code className="rounded bg-[#f1f5f9] px-1 font-mono text-xs">/intake/[slug]</code> and{" "}
        <code className="rounded bg-[#f1f5f9] px-1 font-mono text-xs">/embed?slug=…</code>.
      </p>

      <ul className="mt-8 divide-y divide-[#e2e0d9] rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
        {firms.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <p className="font-medium text-[#0f172a]">{f.name}</p>
              <p className="text-sm text-[#64748b]">
                Slug: <span className="font-mono text-xs">{f.slug}</span>
                {f.notificationEmail ? (
                  <>
                    {" "}
                    · Alerts: <span className="text-[#475569]">{f.notificationEmail}</span>
                  </>
                ) : null}
              </p>
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
