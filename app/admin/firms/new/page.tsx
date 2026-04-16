import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-context";
import { CreateFirmForm } from "@/components/admin/CreateFirmForm";

export const dynamic = "force-dynamic";

export default async function NewFirmPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (ctx.role !== "operator") notFound();

  return (
    <div>
      <p className="text-sm text-[#64748b]">
        <Link href="/admin/firms" className="text-[#0f172a] underline hover:no-underline">
          ← Firms
        </Link>
      </p>
      <h1 className="mt-4 font-serif text-2xl font-semibold text-[#0f172a]">New firm</h1>
      <p className="mt-1 text-sm text-[#64748b]">
        Creates the firm in a <strong>Pending setup</strong> state. Set it to Active once the firm is configured and ready to accept intake.
      </p>
      <CreateFirmForm />
    </div>
  );
}
