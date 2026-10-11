/**
 * Stage G (mock): deterministic close decisions for simulated executions.
 *
 * Pure functions — no network, no database — so the decision logic is
 * testable without Hyperliquid access and runs identically regardless of
 * which executions it is later applied to. The `simulated` flag on the
 * row selects this path; it never changes the math.
 *
 * Data model (docs/DATA_MODEL.md §2, D-018.5): the Pass's authored levels
 * come from the `pass_versions` snapshot the execution references, never
 * from the live `passes` row, so a later edit cannot rewrite history.
 */

export type SimulatedOutcome = "tp_hit" | "sl_hit";

export interface BracketLevels {
  direction: "long" | "short";
  entryPrice: string | null;
  takeProfit: string | null;
  stopLoss: string | null;
}

function finite(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Decides which bracket leg the current mid has reached, if any.
 *
 * Long: mid at/above take-profit → tp_hit; mid at/below stop-loss → sl_hit.
 * Short: mirrored. Take-profit is checked first so a pathological plan
 * whose levels overlap still closes deterministically. A null leg can
 * never hit. Null mid (no market reading) is never a decision.
 */
export function decideSimulatedClose(
  levels: BracketLevels,
  mid: string | null | undefined,
): SimulatedOutcome | null {
  const px = finite(mid);
  if (px === null) return null;
  const tp = finite(levels.takeProfit);
  const sl = finite(levels.stopLoss);
  if (levels.direction === "long") {
    if (tp !== null && px >= tp) return "tp_hit";
    if (sl !== null && px <= sl) return "sl_hit";
    return null;
  }
  if (tp !== null && px <= tp) return "tp_hit";
  if (sl !== null && px >= sl) return "sl_hit";
  return null;
}

/**
 * Realized PnL for a simulated close, in quote currency: base size times
 * the signed price move from entry to the exit leg, in the Pass direction.
 * Returns null when any input is unusable — the close decision stands
 * (the leg hit), but no figure is fabricated.
 */
export function simulatedClosePnl(params: {
  direction: "long" | "short";
  entryPrice: string | null;
  exitPrice: string | null;
  baseSize: string | null;
}): string | null {
  const entry = finite(params.entryPrice);
  const exit = finite(params.exitPrice);
  const size = finite(params.baseSize);
  if (entry === null || exit === null || size === null || size <= 0) return null;
  const move = params.direction === "long" ? exit - entry : entry - exit;
  return String(Math.round((size * move + Number.EPSILON) * 100) / 100);
}

/**
 * Initial dollar risk of the trade as authored: |entry − stop| × base
 * size. Null when the plan carries no stop or the inputs are unusable —
 * an R multiple over zero risk would be infinite, and an infinite figure
 * is a fabrication.
 */
export function tradeRiskDollars(params: {
  entryPrice: string | null;
  stopLoss: string | null;
  baseSize: string | null;
}): number | null {
  const entry = finite(params.entryPrice);
  const stop = finite(params.stopLoss);
  const size = finite(params.baseSize);
  if (entry === null || stop === null || size === null || size <= 0) return null;
  const risk = Math.abs(entry - stop) * size;
  return risk > 0 ? risk : null;
}
