import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6f5f2] text-[#0f172a]">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#64748b]">Phalerae</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#0f172a]">
          AI intake for personal injury firms
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[#475569]">
          Capture inbound leads with a guided, chat-style assistant. Structured data, clear disclaimers, and
          operator review — without substituting for an attorney.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/intake/demo"
            className="inline-flex rounded-lg bg-[#1e3a5f] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#152a45]"
          >
            Open demo intake
          </Link>
          <Link
            href="/embed?slug=demo"
            className="inline-flex rounded-lg border border-[#cbd5e1] bg-white px-5 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Embed widget (demo)
          </Link>
          <Link
            href="/admin/login"
            className="inline-flex rounded-lg border border-[#cbd5e1] bg-white px-5 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Operator dashboard
          </Link>
        </div>
        <p className="mt-12 text-sm text-[#64748b]">
          Local setup: see <code className="rounded bg-[#e2e8f0] px-1.5 py-0.5 font-mono text-xs">README.md</code>{" "}
          in the project root.
        </p>
      </div>
    </div>
  );
}
