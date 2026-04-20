"use client";

import Link from "next/link";

export function AdminHeader() {
  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <header className="border-b border-[#e2e0d9] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6 text-sm">
          <span className="font-semibold tracking-tight text-[#0f172a]">Phalerae Admin</span>
          <nav className="flex gap-4 text-[#475569]">
            <Link className="hover:text-[#0f172a]" href="/admin/leads">
              Leads
            </Link>
            <Link className="hover:text-[#0f172a]" href="/admin/firms">
              Firms
            </Link>
            <Link className="hover:text-[#0f172a]" href="/admin/account">
              Account
            </Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm text-[#64748b] underline-offset-4 hover:text-[#0f172a] hover:underline"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
