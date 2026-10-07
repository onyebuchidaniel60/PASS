/**
 * Display formatting. Values are decimal strings end to end and are never
 * parsed into binary floats for arithmetic (docs/DATA_MODEL.md §4).
 */

export function fmtPrice(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  const decimals = Math.abs(n) < 1 ? 4 : 2;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtSize(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 5 });
}

/** Signed PnL. The sign is always present; colour is never the only cue. */
export function fmtPnl(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  const s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** Compact form for social/OG and headline contexts only (design/DESIGN.md §11.2). */
export function fmtCompact(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

export function fmtUtc(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Inside this window, a recent past timestamp reads as "just now". */
const JUST_NOW_WINDOW = 60_000;

/**
 * Distance between a timestamp and now.
 *
 * FUTURE TIMESTAMPS ARE THE POINT OF THIS FUNCTION.
 *
 * The previous implementation did `const diff = Date.now() - d` and tested the
 * resulting magnitude, so any future timestamp — an expiry date, an end time —
 * produced a negative count that fell into the smallest bucket and rendered as
 * "just now". A Taker reading an open Pass would be told its window had already
 * closed. It now reads "in the future", which is vague but not wrong; this
 * version reports the actual distance instead, so an expiry a week out reads
 * "in 7d".
 *
 * Sign is checked before magnitude, and the future branch never emits "ago".
 */
export function formatRelative(
  v: string | Date | number | null | undefined,
  now: Date = new Date(),
): string {
  if (v === null || v === undefined || v === "") return "";
  const d = v instanceof Date ? v.getTime() : new Date(v).getTime();
  if (Number.isNaN(d)) return "";

  const diff = now.getTime() - d;

  if (diff < 0) {
    // Forward: a distance, never "just now".
    const ahead = -diff;
    if (ahead < 60_000) return "in <1m";
    const fm = Math.floor(ahead / 60_000);
    if (fm < 60) return `in ${fm}m`;
    const fh = Math.floor(fm / 60);
    if (fh < 24) return `in ${fh}h`;
    const fd = Math.floor(fh / 24);
    if (fd < 30) return `in ${fd}d`;
    return `in ${Math.floor(fd / 30)}mo`;
  }

  if (diff < JUST_NOW_WINDOW) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Existing call sites keep this name; `formatRelative` is the real one. */
export const relative = formatRelative;

export function truncateAddress(a: string, lead = 4, tail = 4): string {
  if (a.length <= lead + tail + 1) return a;
  return `${a.slice(0, lead)}…${a.slice(-tail)}`;
}

/** Human label for a lifecycle state. Text first, always. */
export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").toUpperCase();
}