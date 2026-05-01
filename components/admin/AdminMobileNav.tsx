"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./AdminNav";
import { SignOutButton } from "./SignOutButton";

export function AdminMobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  function linkClass(href: string): string {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return isActive
      ? "rounded-md bg-[#f1f0eb] px-2 py-1 text-sm font-medium text-[#0f172a]"
      : "rounded-md px-2 py-1 text-sm text-[#475569] hover:bg-[#f6f5f2] hover:text-[#0f172a]";
  }

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(item.href)}>
          {item.label}
        </Link>
      ))}
      <Link href="/admin/account" className={linkClass("/admin/account")}>
        Account
      </Link>
      <SignOutButton />
    </nav>
  );
}
