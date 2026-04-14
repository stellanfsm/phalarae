"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded border border-[#cbd5e1] bg-[#fafaf8] px-2.5 py-1 text-xs font-medium text-[#334155] transition-colors hover:bg-[#f1f5f9]"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
