"use client";

import { useRef, useState, useTransition } from "react";
import { createFirmAction } from "@/app/admin/firms/actions";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function CreateFirmForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) {
      setSlug(slugify(e.target.value));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugTouched(true);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setError(null);
    startTransition(async () => {
      const result = await createFirmAction(fd);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-5">
      <div>
        <label className="block text-sm font-medium text-[#334155]" htmlFor="cf-name">
          Firm name <span className="text-red-500">*</span>
        </label>
        <input
          id="cf-name"
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          onChange={handleNameChange}
          className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
          placeholder="Acme Injury Law"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#334155]" htmlFor="cf-slug">
          Slug <span className="text-red-500">*</span>
        </label>
        <p className="mt-0.5 text-xs text-[#94a3b8]">
          Used in the intake URL: <code className="font-mono">/intake/[slug]</code>. Lowercase letters, numbers, and hyphens only. Cannot be changed later.
        </p>
        <input
          id="cf-slug"
          name="slug"
          type="text"
          required
          maxLength={80}
          autoComplete="off"
          value={slug}
          onChange={handleSlugChange}
          className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 font-mono text-sm outline-none ring-[#0f172a] focus:ring-2"
          placeholder="acme-injury-law"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#334155]" htmlFor="cf-email">
          Notification email
        </label>
        <p className="mt-0.5 text-xs text-[#94a3b8]">
          Where new lead alerts are sent. Can be set or changed later in firm settings.
        </p>
        <input
          id="cf-email"
          name="notificationEmail"
          type="email"
          maxLength={255}
          autoComplete="off"
          className="mt-1 w-full rounded-md border border-[#cbd5e1] px-3 py-2 text-sm outline-none ring-[#0f172a] focus:ring-2"
          placeholder="intake@acme.com"
        />
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1e3a5f] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#152a45] disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create firm"}
      </button>
    </form>
  );
}
