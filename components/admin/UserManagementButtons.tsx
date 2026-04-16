"use client";

import { useState, useTransition } from "react";
import {
  deactivateUserAction,
  reactivateUserAction,
} from "@/app/admin/firms/[id]/users/actions";

type Props = {
  firmId: string;
  userId: string;
  isDeactivated: boolean;
  canDeactivate: boolean;
};

export function UserManagementButtons({
  firmId,
  userId,
  isDeactivated,
  canDeactivate,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDeactivate() {
    setError(null);
    startTransition(async () => {
      try {
        await deactivateUserAction(firmId, userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleReactivate() {
    setError(null);
    startTransition(async () => {
      try {
        await reactivateUserAction(firmId, userId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {isDeactivated ? (
        <button
          type="button"
          onClick={handleReactivate}
          disabled={pending}
          className="rounded border border-[#cbd5e1] bg-[#fafaf8] px-2.5 py-1 text-xs font-medium text-[#334155] hover:bg-[#f1f5f9] disabled:opacity-60"
        >
          {pending ? "…" : "Reactivate"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleDeactivate}
          disabled={pending || !canDeactivate}
          title={
            !canDeactivate
              ? "Cannot deactivate the last active firm admin."
              : undefined
          }
          className="rounded border border-[#cbd5e1] bg-[#fafaf8] px-2.5 py-1 text-xs font-medium text-[#334155] hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "…" : "Deactivate"}
        </button>
      )}
      {error && (
        <p className="max-w-[200px] text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
