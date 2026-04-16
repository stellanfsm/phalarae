"use client";

import { useRef, useState, useTransition } from "react";
import { addLeadNoteAction } from "@/app/admin/leads/[id]/actions";

const MAX_LENGTH = 2000;
const COUNTER_THRESHOLD = 1800;

export function LeadNoteInput({ leadId }: { leadId: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await addLeadNoteAction(leadId, content);
        setContent("");
        textareaRef.current?.focus();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const charsLeft = MAX_LENGTH - content.length;

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add an internal note…"
        maxLength={MAX_LENGTH}
        rows={3}
        disabled={pending}
        className="w-full resize-none rounded-lg border border-[#d1d5db] bg-[#fafafa] px-3 py-2.5 text-sm outline-none transition focus:border-[#94a3b8] focus:bg-white focus:ring-2 focus:ring-[#0f172a]/10 disabled:opacity-60"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex items-center gap-3">
          {content.length >= COUNTER_THRESHOLD && (
            <span className={`text-xs ${charsLeft < 100 ? "text-red-500" : "text-[#94a3b8]"}`}>
              {charsLeft} remaining
            </span>
          )}
          <button
            type="submit"
            disabled={!content.trim() || pending}
            className="rounded-lg border border-[#cbd5e1] bg-[#fafaf8] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50"
          >
            Add note
          </button>
        </div>
      </div>
    </form>
  );
}
