import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "@/lib/admin-context";
import { AdminNav, type NavItem } from "./AdminNav";
import { SignOutButton } from "./SignOutButton";
import { AdminMobileNav } from "./AdminMobileNav";

function roleLabel(role: AdminContext["role"]): string {
  switch (role) {
    case "operator":   return "Operator";
    case "firm_admin": return "Firm admin";
    case "firm_staff": return "Staff";
  }
}

function getNavItems(ctx: AdminContext): NavItem[] {
  const items: NavItem[] = [{ href: "/admin/leads", label: "Leads" }];
  if (ctx.role === "operator") {
    items.push({ href: "/admin/firms", label: "Firms" });
  } else if (ctx.role === "firm_admin" && ctx.firmId) {
    items.push({ href: `/admin/firms/${ctx.firmId}`, label: "Workspace" });
  }
  return items;
}

export function AdminShell({
  ctx,
  children,
}: {
  ctx: AdminContext;
  children: ReactNode;
}) {
  const navItems = getNavItems(ctx);

  return (
    <div className="flex min-h-screen bg-[#f6f5f2]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:border-[#e2e0d9] md:bg-white">
        {/* Wordmark */}
        <div className="border-b border-[#e2e0d9] px-5 py-4">
          <span className="text-sm font-semibold tracking-tight text-[#0f172a]">
            Phalerae
          </span>
        </div>

        {/* Nav */}
        <div className="flex-1 px-2 py-3">
          <AdminNav items={navItems} />
        </div>

        {/* User block */}
        <div className="space-y-3 border-t border-[#e2e0d9] px-4 py-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[#334155]">
              {ctx.email}
            </p>
            <p className="mt-0.5 text-xs text-[#94a3b8]">{roleLabel(ctx.role)}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Link
              href="/admin/account"
              className="text-sm text-[#64748b] hover:text-[#0f172a]"
            >
              Account settings
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* ── Content column (mobile top bar + main) ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-2 border-b border-[#e2e0d9] bg-white px-4 py-3 md:hidden">
          <span className="text-sm font-semibold tracking-tight text-[#0f172a]">
            Phalerae
          </span>
          <AdminMobileNav items={navItems} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
