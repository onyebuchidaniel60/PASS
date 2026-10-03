import { describe, expect, it } from "vitest";
import {
  aggregatePassPerformance,
  aggregateTraderPerformance,
  round2,
  sideFor,
} from "./performance.js";

describe("PASS performance aggregation", () => {
  it("counts takers and separates completed from open", () => {
    const agg = aggregatePassPerformance([
      { status: "tp_hit", realizedPnl: "120" },
      { status: "sl_hit", realizedPnl: "-80" },
      { status: "manually_closed", realizedPnl: "10" },
      { status: "open", realizedPnl: null },
    ]);
    expect(agg.takersCount).toBe(4);
    expect(agg.completedCount).toBe(3);
    expect(agg.tpHitCount).toBe(1);
    expect(agg.slHitCount).toBe(1);
    expect(agg.manuallyClosedCount).toBe(1);
  });

  it("never lets open executions inflate the success rate", () => {
    const agg = aggregatePassPerformance([
      { status: "tp_hit", realizedPnl: null },
      { status: "open", realizedPnl: null },
      { status: "open", realizedPnl: null },
      { status: "open", realizedPnl: null },
    ]);
    expect(agg.completedCount).toBe(1);
    expect(agg.successRatePct).toBe(100);
  });

  it("returns null success rate when nothing has completed", () => {
    const agg = aggregatePassPerformance([{ status: "open", realizedPnl: null }]);
    expect(agg.successRatePct).toBeNull();
    expect(agg.totalRealizedPnl).toBeNull();
  });

  it("sums realized PnL across completed executions only", () => {
    const agg = aggregatePassPerformance([
      { status: "tp_hit", realizedPnl: "100.55" },
      { status: "sl_hit", realizedPnl: "-40.25" },
      { status: "open", realizedPnl: "9999" },
    ]);
    // Aggregated PnL is a normalised decimal string. Compare numerically so
    // the assertion does not depend on trailing-zero formatting.
    expect(Number(agg.totalRealizedPnl)).toBe(60.3);
  });

  it("recomputes the trader rate from merged totals rather than averaging", () => {
    // Pass A: 1 of 1 TP. Pass B: 0 of 9 TP. A naive average would say 50%.
    const merged = aggregateTraderPerformance([
      {
        takersCount: 1,
        completedCount: 1,
        tpHitCount: 1,
        slHitCount: 0,
        manuallyClosedCount: 0,
        successRatePct: 100,
        totalRealizedPnl: "10",
      },
      {
        takersCount: 9,
        completedCount: 9,
        tpHitCount: 0,
        slHitCount: 9,
        manuallyClosedCount: 0,
        successRatePct: 0,
        totalRealizedPnl: "-90",
      },
    ]);
    expect(merged.completedCount).toBe(10);
    expect(merged.tpHitCount).toBe(1);
    expect(merged.successRatePct).toBe(10);
    expect(merged.totalRealizedPnl).toBe("-80");
  });

  it("maps direction to the correct side", () => {
    expect(sideFor("long")).toBe("buy");
    expect(sideFor("short")).toBe("sell");
  });

  it("rounds consistently to 2dp", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});