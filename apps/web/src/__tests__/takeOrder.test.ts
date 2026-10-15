import { describe, expect, it } from "vitest";

import {
  buildTakeAction,
  entrySourceLabel,
  executionBody,
  floorBaseSize,
  marketablePrice,
  newClientRequestId,
  resolveEntryPrice,
} from "../lib/take-order";

/**
 * D-025 order numbers. Pure math, no network, no wallet: the preview and
 * the submit share these functions, so agreeing here means agreeing there.
 */
describe("D-025.1 entry price", () => {
  it("uses the authored entry for a limit Pass, ignoring mid", () => {
    expect(
      resolveEntryPrice({ entryType: "limit", entryPrice: "113400", midPrice: "113500" }),
    ).toBe("113400");
  });

  it("uses the current mid for a market Pass, ignoring any entry", () => {
    expect(
      resolveEntryPrice({ entryType: "market", entryPrice: "113400", midPrice: "113500" }),
    ).toBe("113500");
  });

  it("returns null when the needed price is missing", () => {
    expect(resolveEntryPrice({ entryType: "limit", entryPrice: "", midPrice: "x" })).toBeNull();
    expect(resolveEntryPrice({ entryType: "limit", entryPrice: null, midPrice: "x" })).toBeNull();
    expect(resolveEntryPrice({ entryType: "market", entryPrice: null, midPrice: null })).toBeNull();
  });

  it("labels the source for display", () => {
    expect(entrySourceLabel("limit")).toBe("Pass limit");
    expect(entrySourceLabel("market")).toBe("Current mid");
  });
});

describe("D-025.2 base size floor", () => {
  it("divides and floors to szDecimals, never rounding up", () => {
    // 1250 / 113400 = 0.0110229… at 5 decimals the exact value reads
    // 0.01102|29 — the signer must send 0.01102, not 0.01103.
    expect(floorBaseSize(1250, "113400", 5)).toBe("0.01102");
    // 100 / 113400 = 0.00088183… → 0.00088.
    expect(floorBaseSize(100, "113400", 5)).toBe("0.00088");
  });

  it("keeps exact decimal places", () => {
    expect(floorBaseSize(250, "3400", 4)).toBe("0.0735");
  });

  it("returns null instead of signing a zero or unusable size", () => {
    // Floors to zero at 5 decimals: must never be signed.
    expect(floorBaseSize(0.001, "113400", 5)).toBeNull();
    expect(floorBaseSize(0, "113400", 5)).toBeNull();
    expect(floorBaseSize(-5, "113400", 5)).toBeNull();
    expect(floorBaseSize(100, "0", 5)).toBeNull();
    expect(floorBaseSize(100, "abc", 5)).toBeNull();
    expect(floorBaseSize(100, "113400", -1)).toBeNull();
  });
});

describe("marketable price (market entries fill instead of resting)", () => {
  // BTC perp shape: szDecimals 5 -> at most 1 price decimal.
  const BTC = 5;

  it("prices a buy above the mid by the tolerance", () => {
    // 113500 + 50bps = 114067.5 -> 0 decimals (5 sig figs) -> "114068".
    expect(
      marketablePrice({ midPrice: "113500", isBuy: true, slippageToleranceBps: 50, szDecimals: BTC }),
    ).toBe("114068");
  });

  it("prices a sell below the mid by the tolerance", () => {
    // 113500 - 50bps = 112932.5 -> "112932", strictly below mid.
    expect(
      marketablePrice({ midPrice: "113500", isBuy: false, slippageToleranceBps: 50, szDecimals: BTC }),
    ).toBe("112932");
  });

  it("caps decimals at the asset's tick, not the mid's precision", () => {
    // 4120.55 + 50bps = 4141.15275, but the tick allows 1 decimal -> "4141.2".
    expect(
      marketablePrice({ midPrice: "4120.55", isBuy: true, slippageToleranceBps: 50, szDecimals: BTC }),
    ).toBe("4141.2");
  });

  it("never lands on the mid, even when rounding would", () => {
    // 0bps tolerance: raw equals mid, so the tick nudge keeps it aggressive.
    expect(
      marketablePrice({ midPrice: "100", isBuy: true, slippageToleranceBps: 0, szDecimals: BTC }),
    ).toBe("100.1");
    expect(
      marketablePrice({ midPrice: "100", isBuy: false, slippageToleranceBps: 0, szDecimals: BTC }),
    ).toBe("99.9");
  });

  it("rounds a fractional mid to a valid tick", () => {
    // 114068.4999 + 50bps, 5 sig figs -> integer "114639".
    expect(
      marketablePrice({ midPrice: "114068.4999", isBuy: true, slippageToleranceBps: 50, szDecimals: BTC }),
    ).toBe("114639");
  });

  it("returns null for an unusable mid or szDecimals", () => {
    expect(marketablePrice({ midPrice: null, isBuy: true, szDecimals: BTC })).toBeNull();
    expect(marketablePrice({ midPrice: "", isBuy: true, szDecimals: BTC })).toBeNull();
    expect(marketablePrice({ midPrice: "abc", isBuy: true, szDecimals: BTC })).toBeNull();
    expect(marketablePrice({ midPrice: "0", isBuy: true, szDecimals: BTC })).toBeNull();
    expect(marketablePrice({ midPrice: "-5", isBuy: true, szDecimals: BTC })).toBeNull();
    expect(marketablePrice({ midPrice: "113500", isBuy: true, szDecimals: null })).toBeNull();
    expect(marketablePrice({ midPrice: "113500", isBuy: true, szDecimals: undefined })).toBeNull();
    expect(marketablePrice({ midPrice: "113500", isBuy: true, szDecimals: -1 })).toBeNull();
    expect(marketablePrice({ midPrice: "113500", isBuy: true, szDecimals: 2.5 })).toBeNull();
  });
});

describe("marketable price tick divisibility across assets", () => {
  /** The venue rule, asserted numerically: decimals within tick AND (integer or 5 sig figs). */
  function tickOk(pxStr: string, szDecimals: number): boolean {
    const v = Number(pxStr);
    if (!Number.isFinite(v) || v <= 0) return false;
    const d = pxStr.includes(".") ? pxStr.split(".")[1]!.length : 0;
    if (d > 6 - szDecimals) return false;
    if (Number.isInteger(v)) return true;
    return d <= 4 - Math.floor(Math.log10(v));
  }

  it("is a tick multiple for every szDecimals 0–6, buy and sell", () => {
    const mids = ["150.25", "4120.55", "113500", "0.01234", "114068.4999", "1.5", "99999"];
    for (let sz = 0; sz <= 6; sz += 1) {
      for (const mid of mids) {
        for (const isBuy of [true, false]) {
          const px = marketablePrice({ midPrice: mid, isBuy, slippageToleranceBps: 50, szDecimals: sz });
          // Sub-tick mids on integer-tick assets fail closed (null) rather
          // than signing a non-tick price; everything else must be valid.
          if (px === null) continue;
          expect(tickOk(px, sz), `sz=${sz} mid=${mid} ${isBuy ? "buy" : "sell"} -> ${px}`).toBe(true);
          const v = Number(px);
          const m = Number(mid);
          expect(isBuy ? v > m : v < m).toBe(true);
        }
      }
    }
  });

  it("prices SOL-perp (asset 4, szDecimals 2) on a valid tick", () => {
    // 152.34 + 50bps = 153.1017 -> 2 decimals -> "153.10" -> stripped "153.1".
    const buy = marketablePrice({ midPrice: "152.34", isBuy: true, slippageToleranceBps: 50, szDecimals: 2 });
    expect(buy).toBe("153.1");
    expect(tickOk(buy!, 2)).toBe(true);
    const sell = marketablePrice({ midPrice: "152.34", isBuy: false, slippageToleranceBps: 50, szDecimals: 2 });
    expect(sell).toBe("151.58");
    expect(tickOk(sell!, 2)).toBe(true);
  });

  it("prices a different-szDecimals asset (BTC, szDecimals 5) on its own tick", () => {
    const buy = marketablePrice({ midPrice: "113500", isBuy: true, slippageToleranceBps: 50, szDecimals: 5 });
    expect(buy).toBe("114068");
    expect(tickOk(buy!, 5)).toBe(true);
  });
});

describe("take bracket assembly", () => {
  it("emits entry plus both exits in one normalTpsl action", () => {
    const action = buildTakeAction({
      assetIndex: 0,
      isBuy: true,
      entryPrice: "113400",
      baseSize: "0.01102",
      takeProfit: "116000",
      stopLoss: "111900",
    });
    expect(action.type).toBe("order");
    expect(action.grouping).toBe("normalTpsl");
    expect(action.orders).toHaveLength(3);
    const [entry, tp, sl] = action.orders as Array<Record<string, unknown>>;
    expect(entry).toMatchObject({ a: 0, b: true, p: "113400", s: "0.01102", r: false });
    expect(tp).toMatchObject({ b: false, r: true });
    expect(sl).toMatchObject({ b: false, r: true });
    expect((tp?.t as { trigger: { tpsl: string } }).trigger.tpsl).toBe("tp");
    expect((sl?.t as { trigger: { tpsl: string } }).trigger.tpsl).toBe("sl");
  });

  it("defaults the entry to Gtc and forwards an Ioc override for market entries", () => {
    const def = buildTakeAction({
      assetIndex: 0,
      isBuy: true,
      entryPrice: "113400",
      baseSize: "0.01102",
      takeProfit: null,
      stopLoss: null,
    });
    expect((def.orders[0]?.t as { limit: { tif: string } }).limit.tif).toBe("Gtc");
    const ioc = buildTakeAction({
      assetIndex: 0,
      isBuy: true,
      entryPrice: "114068",
      baseSize: "0.01095",
      takeProfit: null,
      stopLoss: null,
      tif: "Ioc",
    });
    const [entry] = ioc.orders as Array<Record<string, unknown>>;
    expect(entry).toMatchObject({ p: "114068", r: false });
    expect((entry?.t as { limit: { tif: string } }).limit.tif).toBe("Ioc");
  });
});

describe("executions body", () => {
  it("carries the signed payload and no demo marker", () => {
    const body = executionBody({
      passVersion: 2,
      accountId: "acct-1",
      clientRequestId: "req_abc12345",
      signedPayload: { exchangeRequest: { a: 1 }, signature: { r: "0x1" } },
    });
    expect(body).toEqual({
      passVersion: 2,
      accountId: "acct-1",
      clientRequestId: "req_abc12345",
      signedPayload: { exchangeRequest: { a: 1 }, signature: { r: "0x1" } },
    });
    expect(body).not.toHaveProperty("signedAction");
  });

  it("carries size+leverage for fee math when provided", () => {
    const body = executionBody({
      passVersion: 2,
      accountId: "acct-1",
      clientRequestId: "req_abc12345",
      positionSize: "100",
      leverage: "2",
      signedPayload: { exchangeRequest: { a: 1 }, signature: { r: "0x1" } },
    });
    expect(body).toMatchObject({ positionSize: "100", leverage: "2" });
  });

  it("mints unique request-scoped idempotency keys", () => {
    const a = newClientRequestId();
    const b = newClientRequestId();
    expect(a).toMatch(/^req_[0-9a-f]{32}$/);
    expect(b).toMatch(/^req_[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});
