import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-context";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  return <AdminShell ctx={ctx}>{children}</AdminShell>;
}
