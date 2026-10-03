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

export function relative(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Date.now() - d;
  if (diff < 0) return "in the future";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function truncateAddress(a: string, lead = 4, tail = 4): string {
  if (a.length <= lead + tail + 1) return a;
  return `${a.slice(0, lead)}…${a.slice(-tail)}`;
}

/** Human label for a lifecycle state. Text first, always. */
export function statusLabel(s: string): string {
  return s.replace(/_/g, " ").toUpperCase();
}