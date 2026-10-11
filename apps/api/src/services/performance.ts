import { and, eq, inArray, or } from "drizzle-orm";
import type { AppContext } from "../context.js";
import { executions, passes, passVersions } from "@pass/db";
import {
  aggregatePassPerformance,
  aggregateTraderPerformance,
  round2,
  tradeRiskDollars,
} from "@pass/domain";
import { getProfileBySlug } from "./profile-service.js";

/**
 * Stage G: trader-level PASS performance aggregation.
 *
 * The math is the same domain aggregation that will run over real
 * executions later (`aggregatePassPerformance` per Pass merged by
 * `aggregateTraderPerformance`); only the data source differs. The
 * `simulated` flag is observed for labelling and never changes the
 * computation — there is no simulated-only shortcut anywhere here.
 *
 * PASS performance and Hyperliquid account performance stay separate
 * (D-014): nothing account-level enters this response.
 */

export interface TraderPerformance {
  slug: string;
  publishedPasses: number;
  completedPasses: number;
  /** tp_hit / (tp_hit + sl_hit + manually_closed) over executed Passes. Null when nothing completed. */
  passSuccessMetric: number | null;
  successMetricWindow: "all time";
  /** Mean realized-PnL-over-risk across closed executions. Null when none computable. */
  averageRMultiple: number | null;
  totalRealizedPnl: string | null;
  /** True when every contributing execution is simulated; false when any is
   * real; null when the trader has no executions yet. */
  simulated: boolean | null;
  updatedAt: string;
}

const COMPLETED_PASS_STATUSES = ["tp_hit", "sl_hit", "manually_closed", "expired"];
const OUTCOME_EXECUTION_STATUSES = ["tp_hit", "sl_hit", "manually_closed"];

export async function traderPerformance(
  ctx: AppContext,
  slug: string,
): Promise<TraderPerformance> {
  const profile = await getProfileBySlug(ctx, slug);
  const owned = await ctx.db
    .select()
    .from(passes)
    .where(eq(passes.traderId, profile.userId));

  const published = owned.filter((p) => p.status !== "draft");
  const completed = owned.filter((p) => COMPLETED_PASS_STATUSES.includes(p.status));
  const passIds = published.map((p) => p.id);

  const execs =
    passIds.length === 0
      ? []
      : await ctx.db.select().from(executions).where(inArray(executions.passId, passIds));

  // Per-Pass aggregates through the shared domain math, then merged. Passes
  // nobody took contribute nothing, so "executed Passes only" holds by
  // construction.
  const byPass = new Map<string, Array<{ status: "tp_hit" | "sl_hit" | "manually_closed" | "open"; realizedPnl: string | null }>>();
  for (const e of execs) {
    const list = byPass.get(e.passId) ?? [];
    list.push({
      status: (["tp_hit", "sl_hit", "manually_closed"] as const).includes(
        e.status as "tp_hit" | "sl_hit" | "manually_closed",
      )
        ? (e.status as "tp_hit" | "sl_hit" | "manually_closed")
        : "open",
      realizedPnl: e.realizedPnl,
    });
    byPass.set(e.passId, list);
  }
  const merged = aggregateTraderPerformance(
    published.map((p) => aggregatePassPerformance(byPass.get(p.id) ?? [])),
  );

  // Average R over closed executions with a computable risk envelope.
  // Snapshots come from the referenced Pass versions (D-018.5), so later
  // Pass edits cannot rewrite a closed trade's risk.
  let averageRMultiple: number | null = null;
  const closed = execs.filter(
    (e) => OUTCOME_EXECUTION_STATUSES.includes(e.status) && e.realizedPnl !== null,
  );
  if (closed.length > 0) {
    const pairs = [...new Map(closed.map((e) => [`${e.passId}:${e.passVersion}`, e])).values()];
    const snapshots =
      pairs.length === 0
        ? []
        : await ctx.db
            .select()
            .from(passVersions)
            .where(
              or(
                ...pairs.map((e) =>
                  and(eq(passVersions.passId, e.passId), eq(passVersions.version, e.passVersion)),
                ),
              ),
            );
    const snapByPair = new Map(
      snapshots.map((s) => [`${s.passId}:${s.version}`, s.snapshot as Record<string, unknown>]),
    );
    const rs: number[] = [];
    for (const e of closed) {
      const snap = snapByPair.get(`${e.passId}:${e.passVersion}`);
      const risk = tradeRiskDollars({
        entryPrice: typeof snap?.entryPrice === "string" ? snap.entryPrice : null,
        stopLoss: typeof snap?.stopLoss === "string" ? snap.stopLoss : null,
        baseSize: e.positionSize,
      });
      const pnl = Number(e.realizedPnl);
      if (risk !== null && Number.isFinite(pnl)) rs.push(pnl / risk);
    }
    if (rs.length > 0) averageRMultiple = round2(rs.reduce((a, b) => a + b, 0) / rs.length);
  }

  return {
    slug: profile.slug,
    publishedPasses: published.length,
    completedPasses: completed.length,
    passSuccessMetric: merged.successRatePct,
    successMetricWindow: "all time",
    averageRMultiple,
    totalRealizedPnl: merged.totalRealizedPnl,
    simulated: execs.length === 0 ? null : execs.every((e) => e.simulated),
    updatedAt: new Date().toISOString(),
  };
}
