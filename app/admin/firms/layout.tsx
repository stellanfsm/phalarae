import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getAdminContext } from "@/lib/admin-context";

export default async function AdminFirmsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  return (
    <>
      <AdminHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
