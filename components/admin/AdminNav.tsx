"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? "rounded-md bg-[#f1f0eb] px-3 py-2 text-sm font-medium text-[#0f172a]"
                : "rounded-md px-3 py-2 text-sm text-[#475569] hover:bg-[#f6f5f2] hover:text-[#0f172a]"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
