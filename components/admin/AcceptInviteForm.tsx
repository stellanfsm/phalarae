"use client";

import { useRef, useState, useTransition } from "react";
import { acceptInviteAction } from "@/app/admin/invite/[token]/actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setError(null);
    startTransition(async () => {
      const result = await acceptInviteAction(fd);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="block text-sm font-medium text-[#334155]" htmlFor="invite-name">
          Your name (optional)
        </label>
        <input
          id="invite-name"
          name="name"
          type="text"
          maxLength={100}
          autoComplete="name"
          placeholder="Jane Smith"
          className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#334155]" htmlFor="invite-password">
          Set a password
        </label>
        <input
          id="invite-password"
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={200}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
        />
        <p className="mt-1 text-xs text-[#94a3b8]">Minimum 10 characters.</p>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-[#334155]"
          htmlFor="invite-confirm-password"
        >
          Confirm password
        </label>
        <input
          id="invite-confirm-password"
          name="confirmPassword"
          type="password"
          required
          maxLength={200}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
        />
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-60"
      >
        {pending ? "Setting up account…" : "Accept invite"}
      </button>
    </form>
  );
}
