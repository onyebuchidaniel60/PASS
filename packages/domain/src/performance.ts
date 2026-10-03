/**
 * docs/IMPLEMENTATION_PLAN.md Stage G performance aggregation.
 *
 * PASS performance and Hyperliquid account performance are separate data
 * categories and are never merged into one figure (D-014,
 * docs/PRODUCT_PRD.md §13).
 */

export type Outcome = "tp_hit" | "sl_hit" | "manually_closed" | "open";

export interface ExecutionOutcome {
  status: Outcome;
  realizedPnl: string | null;
}

/**
 * A completed Pass outcome is one that reached a terminal close state.
 * Open executions are counted as takers but are not yet completed outcomes,
 * so they never inflate the success rate.
 */
export function isCompleted(status: Outcome): boolean {
  return status === "tp_hit" || status === "sl_hit" || status === "manually_closed";
}

export interface PassPerformanceAggregate {
  takersCount: number;
  completedCount: number;
  tpHitCount: number;
  slHitCount: number;
  manuallyClosedCount: number;
  /** Percentage of *completed* executions that reached TP. Null when none completed. */
  successRatePct: number | null;
  /** Sum of realized PnL across executions that reported one. Kept separate from the rate. */
  totalRealizedPnl: string | null;
}

export function aggregatePassPerformance(
  executions: readonly ExecutionOutcome[],
): PassPerformanceAggregate {
  let completed = 0;
  let tp = 0;
  let sl = 0;
  let manual = 0;
  let pnlSum = 0;
  let pnlSeen = false;

  for (const ex of executions) {
    if (ex.status === "tp_hit") tp += 1;
    else if (ex.status === "sl_hit") sl += 1;
    else if (ex.status === "manually_closed") manual += 1;

    if (isCompleted(ex.status)) {
      completed += 1;
      if (ex.realizedPnl !== null && ex.realizedPnl !== "") {
        const n = Number(ex.realizedPnl);
        if (Number.isFinite(n)) {
          pnlSum += n;
          pnlSeen = true;
        }
      }
    }
  }

  return {
    takersCount: executions.length,
    completedCount: completed,
    tpHitCount: tp,
    slHitCount: sl,
    manuallyClosedCount: manual,
    successRatePct: completed === 0 ? null : round2((tp / completed) * 100),
    totalRealizedPnl: pnlSeen ? String(round2(pnlSum)) : null,
  };
}

/** Trader-level PASS performance. Same rules, different grouping. */
export function aggregateTraderPerformance(
  perPass: readonly PassPerformanceAggregate[],
): PassPerformanceAggregate {
  const merged = perPass.reduce<PassPerformanceAggregate>(
    (acc, cur) => ({
      takersCount: acc.takersCount + cur.takersCount,
      completedCount: acc.completedCount + cur.completedCount,
      tpHitCount: acc.tpHitCount + cur.tpHitCount,
      slHitCount: acc.slHitCount + cur.slHitCount,
      manuallyClosedCount: acc.manuallyClosedCount + cur.manuallyClosedCount,
      successRatePct: null,
      totalRealizedPnl: null,
    }),
    {
      takersCount: 0,
      completedCount: 0,
      tpHitCount: 0,
      slHitCount: 0,
      manuallyClosedCount: 0,
      successRatePct: null,
      totalRealizedPnl: null,
    },
  );

  // The rate is recomputed from the merged completed count rather than
  // averaged across Passes, so a Pass with one execution cannot outweigh a
  // Pass with fifty.
  merged.successRatePct =
    merged.completedCount === 0
      ? null
      : round2((merged.tpHitCount / merged.completedCount) * 100);

  const withPnl = perPass.filter(
    (p) => p.totalRealizedPnl !== null && p.totalRealizedPnl !== "",
  );
  if (withPnl.length > 0) {
    const sum = withPnl.reduce(
      (a, p) => a + Number(p.totalRealizedPnl as string),
      0,
    );
    merged.totalRealizedPnl = String(round2(sum));
  }

  return merged;
}

/** Shared rounding so the same figure never renders two ways. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function addDecimalStrings(a: string | null, b: string | null): string | null {
  if (a === null || b === null) return null;
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return String(round2(x + y));
}

export function subtractDecimalStrings(
  a: string | null,
  b: string | null,
): string | null {
  if (a === null || b === null) return null;
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return String(round2(x - y));
}

/** Side from direction, used when mapping a PASS execution onto a fill. */
export function sideFor(direction: "long" | "short"): "buy" | "sell" {
  return direction === "long" ? "buy" : "sell";
}