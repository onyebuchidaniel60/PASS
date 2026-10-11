import { describe, expect, it } from "vitest";

import {
  decideSimulatedClose,
  simulatedClosePnl,
  tradeRiskDollars,
} from "./simulated-close.js";

/**
 * Stage G (mock): deterministic close decisions over authored bracket
 * levels. Pure functions — the same math runs over simulated rows today
 * and real rows later; only the data source differs.
 */
describe("decideSimulatedClose", () => {
  it("closes a long as tp_hit when the mid reaches take-profit", () => {
    expect(
      decideSimulatedClose(
        { direction: "long", entryPrice: "113400", takeProfit: "116000", stopLoss: "111900" },
        "116000",
      ),
    ).toBe("tp_hit");
  });

  it("closes a long as sl_hit when the mid reaches stop-loss", () => {
    expect(
      decideSimulatedClose(
        { direction: "long", entryPrice: "113400", takeProfit: "116000", stopLoss: "111900" },
        "111900",
      ),
    ).toBe("sl_hit");
  });

  it("mirrors the legs for a short", () => {
    const levels = {
      direction: "short" as const,
      entryPrice: "113400",
      takeProfit: "111900",
      stopLoss: "116000",
    };
    expect(decideSimulatedClose(levels, "111900")).toBe("tp_hit");
    expect(decideSimulatedClose(levels, "116000")).toBe("sl_hit");
    expect(decideSimulatedClose(levels, "113400")).toBeNull();
  });

  it("leaves the execution open while the mid sits between the legs", () => {
    expect(
      decideSimulatedClose(
        { direction: "long", entryPrice: "113400", takeProfit: "116000", stopLoss: "111900" },
        "114000",
      ),
    ).toBeNull();
  });

  it("never decides without a market reading or without legs", () => {
    const levels = {
      direction: "long" as const,
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
    };
    expect(decideSimulatedClose(levels, null)).toBeNull();
    expect(
      decideSimulatedClose({ ...levels, takeProfit: null, stopLoss: null }, "200000"),
    ).toBeNull();
  });

  it("prefers take-profit deterministically when levels overlap", () => {
    expect(
      decideSimulatedClose(
        { direction: "long", entryPrice: "100", takeProfit: "90", stopLoss: "110" },
        "100",
      ),
    ).toBe("tp_hit");
  });
});

describe("simulatedClosePnl", () => {
  it("is positive for a long take-profit exit", () => {
    expect(
      simulatedClosePnl({
        direction: "long",
        entryPrice: "113400",
        exitPrice: "116000",
        baseSize: "0.01",
      }),
    ).toBe("26");
  });

  it("is negative for a short stop-loss exit", () => {
    expect(
      simulatedClosePnl({
        direction: "short",
        entryPrice: "113400",
        exitPrice: "116000",
        baseSize: "0.01",
      }),
    ).toBe("-26");
  });

  it("returns null instead of fabricating when inputs are unusable", () => {
    expect(
      simulatedClosePnl({ direction: "long", entryPrice: null, exitPrice: "116000", baseSize: "0.01" }),
    ).toBeNull();
    expect(
      simulatedClosePnl({ direction: "long", entryPrice: "113400", exitPrice: "116000", baseSize: "0" }),
    ).toBeNull();
  });
});

describe("tradeRiskDollars", () => {
  it("computes |entry − stop| × size", () => {
    expect(
      tradeRiskDollars({ entryPrice: "113400", stopLoss: "111900", baseSize: "0.01" }),
    ).toBe(15);
  });

  it("is null without a stop or with no size", () => {
    expect(tradeRiskDollars({ entryPrice: "113400", stopLoss: null, baseSize: "0.01" })).toBeNull();
    expect(tradeRiskDollars({ entryPrice: "113400", stopLoss: "113400", baseSize: "0.01" })).toBeNull();
  });
});
