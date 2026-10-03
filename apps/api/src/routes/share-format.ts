/**
 * Compact-figure formatters for share text.
 * docs/UX_SPEC.md §14 sanctions the compact form for social/OG contexts only.
 */

export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").toUpperCase();
}

export function fmtCompact(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function fmtPrice(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: Math.abs(n) < 1 ? 4 : 2,
    maximumFractionDigits: Math.abs(n) < 1 ? 4 : 2,
  });
}