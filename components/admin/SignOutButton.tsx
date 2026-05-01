"use client";

export function SignOutButton() {
  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="text-left text-sm text-[#64748b] hover:text-[#0f172a]"
    >
      Sign out
    </button>
  );
}
