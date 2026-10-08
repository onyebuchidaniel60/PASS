import { describe, expect, it } from "vitest";

import { buildOrderAction } from "../lib/hyperliquid";

/**
 * Bracket construction.
 *
 * Before this, `buildOrderAction` emitted exactly ONE order — the entry — while
 * the Pass a Taker reads advertised an entry, a take profit and a stop loss. A
 * Pass taken through that path left an UNPROTECTED position with no exit order
 * resting at the venue (docs/EXECUTION_READINESS.md).
 *
 * Shape verified against the official Hyperliquid Exchange endpoint docs:
 *   t: { trigger: { isMarket, triggerPx, tpsl: "tp" | "sl" } }
 *   grouping: "normalTpsl"
 */

const BTC = 0;

function base(over: Partial<Parameters<typeof buildOrderAction>[0]> = {}) {
  return buildOrderAction({
    assetIndex: BTC,
    isBuy: true, // long
    price: "113400",
    size: "0.5",
    ...over,
  });
}

/** Narrow an unknown order entry to the trigger shape for assertions. */
function triggerOf(order: unknown) {
  const t = (order as { t?: { trigger?: Record<string, unknown> } }).t;
  return t?.trigger ?? null;
}

describe("buildOrderAction with a Pass take profit and stop loss", () => {
  it("submits three orders: entry, take profit, stop loss", () => {
    const action = base({ takeProfit: "116000", stopLoss: "111900" });
    expect(action.orders).toHaveLength(3);
    expect(action.type).toBe("order");
  });

  it("groups them as a bracket", () => {
    // "na" would leave the exchange treating the exits as unrelated orders,
    // which is the bug being fixed.
    const action = base({ takeProfit: "116000", stopLoss: "111900" });
    expect(action.grouping).toBe("normalTpsl");
  });

  it("leaves the entry as a limit order, non-reduce-only", () => {
    const [entry] = base({ takeProfit: "116000", stopLoss: "111900" }).orders;
    expect(entry).toMatchObject({
      a: BTC,
      b: true,
      p: "113400",
      s: "0.5",
      r: false,
      t: { limit: { tif: "Gtc" } },
    });
  });

  it("emits a reduce-only take-profit trigger at the Pass level", () => {
    const action = base({ takeProfit: "116000", stopLoss: "111900" });
    const tp = action.orders[1];
    expect(triggerOf(tp)).toEqual({
      isMarket: true,
      triggerPx: "116000",
      tpsl: "tp",
    });
    expect(tp.r).toBe(true);
  });

  it("emits a reduce-only stop-loss trigger at the Pass level", () => {
    const action = base({ takeProfit: "116000", stopLoss: "111900" });
    const sl = action.orders[2];
    expect(triggerOf(sl)).toEqual({
      isMarket: true,
      triggerPx: "111900",
      tpsl: "sl",
    });
    expect(sl.r).toBe(true);
  });

  it("puts BOTH exits on the side opposite the entry", () => {
    // The single easiest thing to get backwards. An exit on the entry side
    // would ADD to the position instead of closing it.
    const long = base({ takeProfit: "116000", stopLoss: "111900" });
    expect(long.orders[0]?.b).toBe(true);
    expect(long.orders[1]?.b).toBe(false);
    expect(long.orders[2]?.b).toBe(false);

    const short = base({
      isBuy: false,
      takeProfit: "110000",
      stopLoss: "116000",
    });
    expect(short.orders[0]?.b).toBe(false);
    expect(short.orders[1]?.b).toBe(true);
    expect(short.orders[2]?.b).toBe(true);
  });

  it("sizes every leg to the Taker's own size", () => {
    const action = base({ takeProfit: "116000", stopLoss: "111900", size: "0.42" });
    for (const order of action.orders) {
      expect(order.s).toBe("0.42");
    }
  });

  it("targets the same asset index on all three legs", () => {
    const action = base({ assetIndex: 7, takeProfit: "116000", stopLoss: "111900" });
    for (const order of action.orders) {
      expect(order.a).toBe(7);
    }
  });
});

describe("buildOrderAction with a partial Pass", () => {
  it("submits two orders for a stop loss only, and invents no take profit", () => {
    const action = base({ takeProfit: null, stopLoss: "111900" });
    expect(action.orders).toHaveLength(2);
    expect(triggerOf(action.orders[1])).toMatchObject({
      triggerPx: "111900",
      tpsl: "sl",
    });
    expect(action.grouping).toBe("normalTpsl");
  });

  it("submits two orders for a take profit only, and invents no stop loss", () => {
    const action = base({ takeProfit: "116000", stopLoss: null });
    expect(action.orders).toHaveLength(2);
    expect(triggerOf(action.orders[1])).toMatchObject({
      triggerPx: "116000",
      tpsl: "tp",
    });
    expect(action.grouping).toBe("normalTpsl");
  });

  it("submits ONE order when the Pass has neither level", () => {
    const action = base();
    expect(action.orders).toHaveLength(1);
    // No exits, so no bracket grouping: "normalTpsl" with a single order is a
    // meaningless action.
    expect(action.grouping).toBe("na");
  });

  it("treats an empty string as absent rather than as a level", () => {
    // "" would serialise as triggerPx:"" and be rejected by the exchange.
    const action = base({ takeProfit: "", stopLoss: "" });
    expect(action.orders).toHaveLength(1);
    expect(action.grouping).toBe("na");
  });
});

describe("buildOrderAction exit mechanics", () => {
  it("marks the trigger orders as market so a gapped level still fills", () => {
    // A stop that triggers into a market gap and then rests unfilled on the
    // book is not a stop.
    const action = base({ takeProfit: "116000", stopLoss: "111900" });
    expect(triggerOf(action.orders[1])?.isMarket).toBe(true);
    expect(triggerOf(action.orders[2])?.isMarket).toBe(true);
  });

  it("carries the trigger price on both the trigger and the resting price", () => {
    // `p` is required even for a market trigger; the exchange acts on
    // triggerPx but rejects the order without p.
    const action = base({ takeProfit: "116000", stopLoss: "111900" });
    expect(action.orders[1]?.p).toBe("116000");
    expect(action.orders[2]?.p).toBe("111900");
  });

  it("never lets an exit carry a limit tif", () => {
    const action = base({ takeProfit: "116000", stopLoss: "111900", tif: "Alo" });
    expect((action.orders[1]?.t as { limit?: unknown }).limit).toBeUndefined();
    expect(triggerOf(action.orders[1])).not.toBeNull();
  });

  it("honours an explicit grouping override", () => {
    expect(
      base({ takeProfit: "116000", stopLoss: "111900", grouping: "positionTpsl" })
        .grouping,
    ).toBe("positionTpsl");
  });
});