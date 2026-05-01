import { type LeadWorkflowStatus } from "@/lib/lead-workflow";
import { leadAlertStatusTooltip } from "@/lib/lead-alert-status";

const BASE =
  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

const QUALIFICATION: Record<string, { style: string; label: string }> = {
  likely_relevant: { style: "bg-emerald-50 text-emerald-900 ring-emerald-200", label: "Likely relevant" },
  needs_review:    { style: "bg-amber-50 text-amber-900 ring-amber-200",       label: "Needs review" },
  low_relevance:   { style: "bg-slate-100 text-slate-700 ring-slate-200",      label: "Low relevance" },
};

const WORKFLOW: Record<LeadWorkflowStatus, { style: string; label: string }> = {
  new:       { style: "bg-amber-50 text-amber-800 ring-amber-200",    label: "New" },
  open:      { style: "bg-slate-100 text-slate-600 ring-slate-200",   label: "Open" },
  contacted: { style: "bg-blue-50 text-blue-800 ring-blue-200",       label: "Contacted" },
  archived:  { style: "bg-slate-100 text-slate-500 ring-slate-200",   label: "Archived" },
};

const ALERT: Record<string, { style: string; label: string }> = {
  sent:         { style: "bg-emerald-50 text-emerald-900 ring-emerald-200", label: "Sent" },
  failed:       { style: "bg-red-50 text-red-900 ring-red-200",             label: "Failed" },
  no_recipient: { style: "bg-slate-100 text-slate-600 ring-slate-200",      label: "No recipient" },
};

const FIRM: Record<string, { style: string; label: string }> = {
  active:   { style: "bg-emerald-50 text-emerald-900 ring-emerald-200", label: "Active" },
  inactive: { style: "bg-slate-100 text-slate-600 ring-slate-200",      label: "Inactive" },
  pending:  { style: "bg-amber-50 text-amber-800 ring-amber-200",       label: "Pending setup" },
};

const FALLBACK = { style: "bg-slate-50 text-slate-600 ring-slate-200", label: "" };

type Props =
  | { variant: "qualification"; value: string; title?: string }
  | { variant: "workflow";      value: string; title?: string }
  | { variant: "alert";         value: string; title?: string }
  | { variant: "firm";          value: string; title?: string };

export function StatusBadge({ variant, value, title }: Props) {
  const map: Record<string, { style: string; label: string }> =
    variant === "qualification" ? QUALIFICATION :
    variant === "workflow"      ? WORKFLOW :
    variant === "alert"         ? ALERT :
    FIRM;

  const { style, label } = map[value] ?? { ...FALLBACK, label: value };

  const baselineTooltip = variant === "alert" ? leadAlertStatusTooltip(value) : undefined;
  const mergedTitle =
    variant === "alert" && (baselineTooltip || title)
      ? [baselineTooltip, title].filter(Boolean).join(" — ")
      : (variant === "alert" ? undefined : title);

  return (
    <span className={`${BASE} ${style}`} title={mergedTitle}>
      {label}
    </span>
  );
}
