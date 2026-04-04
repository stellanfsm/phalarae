import { firmDemoConfig } from "@/config/firm";

/**
 * URL query overrides for /embed (MVP). Keeps CSS injection out of style attributes.
 */

const NAMED_COLORS: Record<string, string> = {
  blue: "#2563eb",
  navy: "#1e3a5f",
  red: "#b91c1c",
  burgundy: "#9e1d20",
  green: "#15803d",
  teal: "#0d9488",
  purple: "#7c3aed",
  slate: "#475569",
  black: "#1e293b",
};

export function defaultEmbedSlug(raw: string | undefined): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s || firmDemoConfig.intakeSlug;
}

export function resolveEmbedPrimaryColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  let p: string;
  try {
    p = decodeURIComponent(String(raw).trim());
  } catch {
    return fallback;
  }
  if (!p) return fallback;
  const lower = p.toLowerCase();
  if (NAMED_COLORS[lower]) return NAMED_COLORS[lower];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(p)) return p;
  return fallback;
}

export function resolveEmbedFirmName(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  try {
    const s = decodeURIComponent(String(raw).trim()).slice(0, 200);
    const cleaned = s.replace(/[<>]/g, "");
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}

export function resolveEmbedLauncherLabel(raw: string | undefined): string {
  const fallback = "Free case review";
  if (!raw) return fallback;
  try {
    const s = decodeURIComponent(String(raw).trim()).slice(0, 80);
    const cleaned = s.replace(/[<>]/g, "");
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}
