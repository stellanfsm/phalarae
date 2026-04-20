import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f6f5f2] px-6 text-[#0f172a]">
      <div className="max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#64748b]">Phalerae</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          AI-powered intake for personal injury firms
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#475569]">
          Structured lead capture with guided conversations, automatic qualification, and
          attorney-ready summaries — without substituting for legal advice.
        </p>
        <div className="mt-8">
          <Link
            href="/admin/login"
            className="inline-flex rounded-lg border border-[#cbd5e1] bg-white px-5 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f1f5f9]"
          >
            Staff sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}
