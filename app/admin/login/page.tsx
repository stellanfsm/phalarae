import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminContext } from "@/lib/admin-context";

export default async function AdminLoginPage() {
  const ctx = await getAdminContext();
  if (ctx) redirect("/admin/leads");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg border border-[#e2e0d9] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-[#0f172a]">Sign in</h1>
        <p className="mt-2 text-sm text-[#64748b]">
          Phalerae lead dashboard. Contact your administrator if you need access.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
