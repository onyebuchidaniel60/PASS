/**
 * One project-wide date-window convention with an explicit timezone basis
 * (UTC). Windows are half-open [start, end) so a boundary instant cannot
 * land in two periods.
 *
 * Period selection is expressed as an offset from now rather than a frozen
 * date, so the default window stays live instead of expiring at mount.
 */

export type PeriodKey = "24h" | "7d" | "30d" | "all";

export const PERIOD_KEYS: readonly PeriodKey[] = ["24h", "7d", "30d", "all"];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

const MS = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
} as const;

export interface DateWindow {
  /** Inclusive start. */
  start: Date;
  /** Exclusive end. */
  end: Date;
  label: string;
}

export function windowForPeriod(
  period: PeriodKey,
  now: Date = new Date(),
): DateWindow {
  const end = new Date(now.getTime());
  switch (period) {
    case "24h":
      return {
        start: new Date(end.getTime() - MS.day),
        end,
        label: PERIOD_LABELS["24h"],
      };
    case "7d":
      return {
        start: new Date(end.getTime() - 7 * MS.day),
        end,
        label: PERIOD_LABELS["7d"],
      };
    case "30d":
      return {
        start: new Date(end.getTime() - 30 * MS.day),
        end,
        label: PERIOD_LABELS["30d"],
      };
    case "all":
      return {
        start: new Date(0),
        end,
        label: PERIOD_LABELS.all,
      };
  }
}

/** Half-open containment: start <= instant < end. */
export function isWithin(instant: Date, window: DateWindow): boolean {
  const t = instant.getTime();
  return t >= window.start.getTime() && t < window.end.getTime();
}

/**
 * Calendar-UTC month window, half-open. Clamps to the target month's real
 * length so stepping from Jan 31 does not roll into March.
 */
export function monthWindow(
  year: number,
  monthIndexZeroBased: number,
): DateWindow {
  const start = new Date(Date.UTC(year, monthIndexZeroBased, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndexZeroBased + 1, 1, 0, 0, 0, 0));
  return {
    start,
    end,
    label: `${start.toISOString().slice(0, 7)}`,
  };
}

/** Shift a month window by whole months without naive date overflow. */
export function shiftMonth(
  year: number,
  monthIndexZeroBased: number,
  delta: number,
): { year: number; monthIndexZeroBased: number } {
  const total = year * 12 + monthIndexZeroBased + delta;
  return {
    year: Math.floor(total / 12),
    monthIndexZeroBased: ((total % 12) + 12) % 12,
  };
}

export function formatUtcStamp(d: Date): string {
  // Minute precision with the zone stated, matching the documented display
  // form `2026-10-03 14:22 UTC`.
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function relativeHint(d: Date, now: Date = new Date()): string {
  const diff = now.getTime() - d.getTime();
  if (diff < 0) return "in the future";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}