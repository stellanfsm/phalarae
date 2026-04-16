import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminContext, requireFirmAccess } from "@/lib/admin-context";
import { InviteForm } from "@/components/admin/InviteForm";
import { UserManagementButtons } from "@/components/admin/UserManagementButtons";

export const dynamic = "force-dynamic";

function roleLabel(role: string): string {
  switch (role) {
    case "operator": return "Operator";
    case "firm_admin": return "Firm admin";
    case "firm_staff": return "Firm staff";
    default: return role;
  }
}

export default async function FirmUsersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  requireFirmAccess(ctx, id);
  if (ctx.role === "firm_staff") notFound();

  const firm = await prisma.firm.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!firm) notFound();

  const [users, pendingInvites, activeFirmAdminCount] = await Promise.all([
    prisma.adminUser.findMany({
      where: { firmId: id },
      orderBy: [{ deactivatedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        deactivatedAt: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.adminInvite.findMany({
      where: { firmId: id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
    prisma.adminUser.count({
      where: { firmId: id, role: "firm_admin", deactivatedAt: null },
    }),
  ]);

  return (
    <div>
      <p className="text-sm text-[#64748b]">
        <Link href={`/admin/firms/${id}`} className="text-[#0f172a] underline hover:no-underline">
          ← {firm.name}
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-2xl font-semibold text-[#0f172a]">Users</h1>
      <p className="mt-0.5 text-xs text-[#94a3b8]">{firm.name}</p>

      <div className="mt-8 max-w-xl rounded-lg border border-[#e2e0d9] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">
          Invite a user
        </h2>
        <p className="mt-1 text-xs text-[#94a3b8]">
          They will receive an email with a link to set their password. Links expire after 72 hours.
        </p>
        <InviteForm firmId={id} />
      </div>

      {pendingInvites.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">
            Pending invites
          </h2>
          <p className="mt-1 text-xs text-[#94a3b8]">
            Invites that have been sent but not yet accepted.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e2e0d9] bg-[#fafaf8] text-xs font-medium uppercase tracking-wide text-[#64748b]">
                <tr>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f0eb]">
                {pendingInvites.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#fafaf8]">
                    <td className="px-4 py-2 text-[#334155]">{inv.email}</td>
                    <td className="px-4 py-2 text-[#475569]">{roleLabel(inv.role)}</td>
                    <td className="px-4 py-2 text-[#94a3b8]">
                      {inv.expiresAt.toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748b]">Users</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-[#e2e0d9] bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2e0d9] bg-[#fafaf8] text-xs font-medium uppercase tracking-wide text-[#64748b]">
              <tr>
                <th className="px-4 py-2">Name / Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Last login</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f0eb]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#94a3b8]">
                    No users yet. Use the invite form above to add the first user.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isDeactivated = u.deactivatedAt !== null;
                  const isLastFirmAdmin =
                    u.role === "firm_admin" && activeFirmAdminCount === 1 && !isDeactivated;
                  return (
                    <tr key={u.id} className={isDeactivated ? "opacity-50 hover:bg-[#fafaf8]" : "hover:bg-[#fafaf8]"}>
                      <td className="px-4 py-3">
                        {u.name && (
                          <div className="font-medium text-[#0f172a]">{u.name}</div>
                        )}
                        <div className="text-[#475569]">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{roleLabel(u.role)}</td>
                      <td className="px-4 py-3 text-[#94a3b8]">
                        {u.lastLoginAt
                          ? u.lastLoginAt.toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isDeactivated ? (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                            Deactivated
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-inset ring-emerald-200">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <UserManagementButtons
                          firmId={id}
                          userId={u.id}
                          isDeactivated={isDeactivated}
                          canDeactivate={!isLastFirmAdmin}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
