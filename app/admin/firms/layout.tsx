import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-context";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminFirmsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (ctx.role === "firm_staff") notFound();

  return <AdminShell ctx={ctx}>{children}</AdminShell>;
}
