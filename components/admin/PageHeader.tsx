import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, backHref, backLabel, action }: Props) {
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="text-sm text-[#64748b] underline-offset-4 hover:text-[#0f172a] hover:underline"
        >
          ← {backLabel ?? "Back"}
        </Link>
      )}
      <div className={`flex flex-wrap items-start justify-between gap-3 sm:items-center ${backHref ? "mt-4" : ""}`}>
        <div>
          <h1 className="font-serif text-2xl font-semibold text-[#0f172a]">{title}</h1>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#64748b]">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
