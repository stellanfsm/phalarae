"use client";

import { useState } from "react";
import { changePasswordAction } from "./actions";

export default function AccountPage() {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg(null);
    const result = await changePasswordAction(new FormData(e.currentTarget));
    if (result.ok) {
      setStatus("success");
      (e.target as HTMLFormElement).reset();
    } else {
      setStatus("error");
      setErrorMsg(result.error);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">Account</h1>
      <p className="mt-1.5 text-sm text-[#64748b]">Change your password below.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-lg border border-[#e2e0d9] bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-[#334155]" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#334155]" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
          />
          <p className="mt-1 text-xs text-[#94a3b8]">Minimum 8 characters</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#334155]" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
          />
        </div>

        {status === "success" && (
          <p className="text-sm font-medium text-emerald-700">Password updated successfully.</p>
        )}
        {status === "error" && errorMsg && (
          <p className="text-sm text-red-700">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full rounded-md bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
