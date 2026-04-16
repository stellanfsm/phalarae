"use client";

import { useRef, useState, useTransition } from "react";
import { sendInviteAction, type InviteActionResult } from "@/app/admin/firms/[id]/users/actions";

type Props = { firmId: string };
type Status = "idle" | "sending" | "sent" | "no_email" | "error";

export function InviteForm({ firmId }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setStatus("sending");
    setMsg(null);
    startTransition(async () => {
      const result: InviteActionResult = await sendInviteAction(firmId, fd);
      if (!result.ok) {
        setStatus("error");
        setMsg(result.error);
        return;
      }
      if (result.emailSent) {
        setStatus("sent");
        setMsg("Invite sent.");
      } else {
        setStatus("no_email");
        setMsg(
          `Invite created but the email could not be sent. Share this link manually:\n${result.inviteUrl}`,
        );
      }
      formRef.current?.reset();
    });
  }

  const sending = status === "sending";

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-5 space-y-4">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Email address
        </label>
        <input
          name="email"
          type="email"
          required
          maxLength={255}
          placeholder="user@firm.com"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[#64748b]">
          Role
        </label>
        <select
          name="role"
          defaultValue="firm_admin"
          className="mt-1 w-full rounded-md border border-[#d1d5db] px-3 py-2 text-sm"
        >
          <option value="firm_admin">Firm admin</option>
          <option value="firm_staff">Firm staff</option>
        </select>
        <p className="mt-1 text-xs text-[#94a3b8]">
          Firm admins can manage users and settings. Firm staff can view leads.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={sending}
          className="w-fit rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#152a45] disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send invite"}
        </button>
        {status === "sent" && (
          <p className="text-sm text-emerald-700">{msg}</p>
        )}
        {status === "no_email" && (
          <pre className="whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {msg}
          </pre>
        )}
        {status === "error" && (
          <p className="text-sm text-red-600">{msg}</p>
        )}
      </div>
    </form>
  );
}
