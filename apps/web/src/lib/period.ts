/**
 * Period windows for surfaces that filter by time (DESIGN.md §10.9).
 *
 * ONE CONVENTION, ONE OWNER.
 *
 * §10.9 requires the period control to use exactly one date convention owned by
 * one helper, expressed as an OFFSET FROM NOW rather than a frozen date, so the
 * default window stays live instead of quietly going stale. That is why this
 * file exists and why nothing else in the codebase may compute a range.
 *
 * The window is HALF-OPEN: `[start, end)`. A row at exactly `start` is inside
 * the window; a row at exactly `end` is not. With closed ranges a boundary row
 * lands in two consecutive windows at once, which double-counts in a total.
 */

export type PeriodId = "24h" | "7d" | "30d" | "all";

export interface PeriodOption {
  id: PeriodId;
  label: string;
  /** Lookback in days. `null` means unbounded. */
  days: number | null;
}

/** The options offered by the §10.9 period control, in order. */
export const PERIODS: PeriodOption[] = [
  { id: "24h", label: "24H", days: 1 },
  { id: "7d", label: "7D", days: 7 },
  { id: "30d", label: "30D", days: 30 },
  { id: "all", label: "ALL", days: null },
];

export interface PeriodWindow {
  /** Inclusive. */
  start: Date;
  /** Exclusive. `null` for the unbounded window. */
  end: Date;
}

/**
 * Resolves a period id to a half-open window ending now.
 *
 * Offsets from `now` on every call rather than caching, so the window is correct
 * whenever the page is actually looked at.
 */
export function periodWindow(id: PeriodId, now: Date = new Date()): PeriodWindow {
  const option = PERIODS.find((p) => p.id === id) ?? PERIODS[1];
  if (option.days === null) {
    return { start: new Date(0), end: new Date(now.getTime()) };
  }
  return {
    start: new Date(now.getTime() - option.days * 24 * 60 * 60_000),
    end: new Date(now.getTime()),
  };
}

/** True when `at` falls inside the half-open `[start, end)` window. */
export function inWindow(at: string | Date | null | undefined, w: PeriodWindow): boolean {
  if (!at) return false;
  const t = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (Number.isNaN(t)) return false;
  return t >= w.start.getTime() && t < w.end.getTime();
}