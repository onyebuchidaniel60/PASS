import { describe, expect, it } from "vitest";

import {
  HIP4_ASSET_ID_OFFSET,
  buildTakeOrderAction,
  decodeOutcomeCoin,
  encodeOutcome,
  isOutcomePlanShape,
  marketableOutcomePrice,
  resolveMarket,
  type MarketOrderAction,
} from "./markets.js";

/**
 * HIP-4 encoding and order shape. The values pinned here are the ones the
 * Hyperliquid asset-id docs define; a regression here signs the wrong asset.
 */
describe("HIP-4 outcome encoding", () => {
  it("encodes outcome 2 side YES as #20 / +20 / 100000020", () => {
    const e = encodeOutcome(2, 0);
    expect(e).not.toBeNull();
    expect(e!.encoding).toBe(20);
    expect(e!.orderCoin).toBe("#20");
    expect(e!.balanceCoin).toBe("+20");
    expect(e!.assetId).toBe(100_000_020);
    expect(e!.sideName).toBe("yes");
  });

  it("applies N = 10 * outcomeId + side (outcome 20 -> #200)", () => {
    const e = encodeOutcome(20, 0)!;
    expect(e.encoding).toBe(200);
    expect(e.orderCoin).toBe("#200");
    expect(e.balanceCoin).toBe("+200");
    expect(e.assetId).toBe(100_000_200);
  });

  it("encodes NO as encoding + 1 and balances as +N", () => {
    const e = encodeOutcome(20, 1)!;
    expect(e.encoding).toBe(201);
    expect(e.orderCoin).toBe("#201");
    expect(e.balanceCoin).toBe("+201");
    expect(e.assetId).toBe(100_000_201);
    expect(e.sideName).toBe("no");
  });

  it("round-trips #N, +N and bare N", () => {
    for (const coin of ["#200", "+200", "200"]) {
      const decoded = decodeOutcomeCoin(coin);
      expect(decoded?.outcomeId).toBe(20);
      expect(decoded?.side).toBe(0);
    }
  });

  it("rejects non-outcome encodings", () => {
    expect(decodeOutcomeCoin("#202")).toBeNull();
    expect(decodeOutcomeCoin("#BTC")).toBeNull();
    expect(decodeOutcomeCoin("+")).toBeNull();
    expect(decodeOutcomeCoin("")).toBeNull();
    expect(encodeOutcome(-1, 0)).toBeNull();
    expect(encodeOutcome(1.5, 0)).toBeNull();
  });
});

describe("market resolution", () => {
  it("resolves a HIP-4 coin with no leverage and USDH collateral", () => {
    const m = resolveMarket({ asset: "#200" });
    expect(m?.assetClass).toBe("hip4");
    expect(m?.assetIndex).toBe(HIP4_ASSET_ID_OFFSET + 200);
    expect(m?.coinString).toBe("#200");
    expect(m?.balanceCoin).toBe("+200");
    expect(m?.maxLeverage).toBeNull();
    expect(m?.collateral).toBe("USDH");
    expect(m?.szDecimals).toBe(2);
    expect(m?.outcome?.side).toBe(0);
    expect(m?.outcome?.sideName).toBe("yes");
  });

  it("resolves a perp from explicit metadata", () => {
    const m = resolveMarket({
      asset: "BTC",
      marketClass: "perp",
      assetIndex: 0,
      szDecimals: 5,
      maxLeverage: 40,
    });
    expect(m?.assetClass).toBe("perp");
    expect(m?.assetIndex).toBe(0);
    expect(m?.collateral).toBe("USDC");
    expect(m?.maxLeverage).toBe(40);
  });

  it("fails closed without a perp asset index", () => {
    expect(resolveMarket({ asset: "BTC", marketClass: "perp" })).toBeNull();
  });

  it("surfaces a venue quote token that differs from the expected collateral", () => {
    const m = resolveMarket({ asset: "#200", quoteToken: "USDC" });
    expect(m?.collateral).toBe("USDH");
    expect(m?.venueQuoteToken).toBe("USDC");
  });
});

describe("HIP-4 order action", () => {
  const market = resolveMarket({ asset: "#200" })!;

  it("emits one entry leg with grouping na and NO reduceOnly", () => {
    const action = buildTakeOrderAction(market, {
      isBuy: true,
      price: "0.62",
      size: "12",
      takeProfit: "0.90",
      stopLoss: "0.20",
      tif: "Ioc",
    });
    expect(action.grouping).toBe("na");
    expect(action.orders).toHaveLength(1);
    const entry = action.orders[0]!;
    expect(entry).toMatchObject({
      a: 100_000_200,
      b: true,
      p: "0.62",
      s: "12",
      t: { limit: { tif: "Ioc" } },
    });
    // The outcome order shape has no `r` field at all. `r: false` is a
    // different wire shape and the venue rejects it for HIP-4.
    expect(entry).not.toHaveProperty("r");
    expect(entry).not.toHaveProperty("t.trigger");
  });

  it("buildExits is empty by construction", () => {
    const action = buildTakeOrderAction(market, {
      isBuy: true,
      price: "0.62",
      size: "12",
      takeProfit: "0.90",
      stopLoss: "0.20",
    });
    expect(action.orders).toHaveLength(1);
    expect(action.grouping).toBe("na");
  });
});

describe("perp regression: order shape unchanged", () => {
  it("keeps reduceOnly false on entry and true on trigger exits", () => {
    const market = resolveMarket({
      asset: "BTC",
      marketClass: "perp",
      assetIndex: 0,
      szDecimals: 5,
      maxLeverage: 40,
    })!;
    const action: MarketOrderAction = buildTakeOrderAction(market, {
      isBuy: true,
      price: "113400",
      size: "0.01102",
      takeProfit: "116000",
      stopLoss: "111900",
      tif: "Gtc",
    });
    expect(action.grouping).toBe("normalTpsl");
    expect(action.orders).toHaveLength(3);
    expect(action.orders[0]).toEqual({
      a: 0,
      b: true,
      p: "113400",
      s: "0.01102",
      r: false,
      t: { limit: { tif: "Gtc" } },
    });
    expect(action.orders[1]).toEqual({
      a: 0,
      b: false,
      p: "116000",
      s: "0.01102",
      r: true,
      t: { trigger: { isMarket: true, triggerPx: "116000", tpsl: "tp" } },
    });
    expect(action.orders[2]).toEqual({
      a: 0,
      b: false,
      p: "111900",
      s: "0.01102",
      r: true,
      t: { trigger: { isMarket: true, triggerPx: "111900", tpsl: "sl" } },
    });
  });

  it("keeps a bare perp entry at grouping na", () => {
    const market = resolveMarket({ asset: "ETH", marketClass: "perp", assetIndex: 1 })!;
    const action = buildTakeOrderAction(market, {
      isBuy: false,
      price: "3584.2",
      size: "0.5",
      tif: "Ioc",
    });
    expect(action.grouping).toBe("na");
    expect(action.orders[0]).toMatchObject({ a: 1, b: false, r: false });
  });
});

describe("outcome probability pricing", () => {
  it("stays inside 0.001–0.999 at 3 decimals", () => {
    expect(marketableOutcomePrice({ midPrice: "0.62", isBuy: true, slippageToleranceBps: 50 })).toBe("0.623");
    expect(marketableOutcomePrice({ midPrice: "0.62", isBuy: false, slippageToleranceBps: 50 })).toBe("0.617");
    expect(marketableOutcomePrice({ midPrice: "0.999", isBuy: true, slippageToleranceBps: 500 })).toBe("0.999");
    expect(marketableOutcomePrice({ midPrice: "0.001", isBuy: false, slippageToleranceBps: 500 })).toBe("0.001");
  });

  it("never lands on the mid at zero tolerance", () => {
    expect(marketableOutcomePrice({ midPrice: "0.5", isBuy: true, slippageToleranceBps: 0 })).toBe("0.501");
    expect(marketableOutcomePrice({ midPrice: "0.5", isBuy: false, slippageToleranceBps: 0 })).toBe("0.499");
  });

  it("fails closed on unusable input", () => {
    expect(marketableOutcomePrice({ midPrice: null, isBuy: true })).toBeNull();
    expect(marketableOutcomePrice({ midPrice: "0", isBuy: true })).toBeNull();
    expect(marketableOutcomePrice({ midPrice: "1.2", isBuy: true })).not.toBeNull();
  });
});

describe("outcome Plan shape", () => {
  it("accepts only market entry with null exits and leverage", () => {
    expect(
      isOutcomePlanShape({
        asset: "#200",
        entryType: "market",
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        leverage: null,
      }),
    ).toBe(true);
    expect(
      isOutcomePlanShape({
        asset: "#200",
        entryType: "limit",
        entryPrice: "0.6",
        stopLoss: null,
        takeProfit: null,
        leverage: null,
      }),
    ).toBe(false);
  });
});
