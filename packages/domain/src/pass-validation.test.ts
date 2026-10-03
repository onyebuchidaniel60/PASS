import { describe, expect, it } from "vitest";
import { validatePlan } from "./pass-validation.js";

const base = {
  asset: "BTC",
  direction: "long" as const,
  entryType: "limit" as const,
  entryPrice: "113400",
  stopLoss: "111900",
  takeProfit: "116000",
  leverage: "5",
  expiresAt: null as string | null,
};

const NOW = new Date("2026-10-03T12:00:00Z");

describe("validatePlan", () => {
  it("accepts a well-formed long plan", () => {
    expect(validatePlan(base, { now: NOW })).toHaveLength(0);
  });

  it("requires an entry price for a limit Pass", () => {
    const f = validatePlan({ ...base, entryPrice: null }, { now: NOW });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ field: "entryPrice", code: "INVALID_PRICE" });
  });

  it("rejects an entry price on a market Pass", () => {
    const f = validatePlan({ ...base, entryType: "market" }, { now: NOW });
    expect(f.some((x) => x.field === "entryPrice")).toBe(true);
  });

  it("requires a long stop below entry and take profit above", () => {
    const f = validatePlan({ ...base, stopLoss: "114000", takeProfit: "112000" }, { now: NOW });
    expect(f.map((x) => x.field).sort()).toEqual(["stopLoss", "takeProfit"]);
  });

  it("mirrors the ordering rule for shorts", () => {
    const f = validatePlan(
      { ...base, direction: "short", stopLoss: "112000", takeProfit: "114000" },
      { now: NOW },
    );
    expect(f.map((x) => x.field).sort()).toEqual(["stopLoss", "takeProfit"]);
  });

  it("accepts a correctly ordered short", () => {
    const f = validatePlan(
      { ...base, direction: "short", stopLoss: "114000", takeProfit: "111000" },
      { now: NOW },
    );
    expect(f).toHaveLength(0);
  });

  it("enforces leverage bounds", () => {
    expect(validatePlan({ ...base, leverage: "0" }, { now: NOW })[0]).toMatchObject({
      field: "leverage",
      code: "INVALID_LEVERAGE",
    });
    expect(validatePlan({ ...base, leverage: "41" }, { now: NOW })[0]).toMatchObject({
      code: "INVALID_LEVERAGE",
    });
  });

  it("rejects an expiry in the past", () => {
    const f = validatePlan(
      { ...base, expiresAt: "2026-10-01T00:00:00Z" },
      { now: NOW },
    );
    expect(f[0]).toMatchObject({ field: "expiresAt" });
  });

  it("accepts a future expiry", () => {
    const f = validatePlan({ ...base, expiresAt: "2026-10-10T00:00:00Z" }, { now: NOW });
    expect(f).toHaveLength(0);
  });

  it("rejects an unsupported asset only when a supported list is supplied", () => {
    expect(validatePlan(base, { supportedAssets: ["BTC", "ETH"] })).toHaveLength(0);
    const f = validatePlan({ ...base, asset: "DOGE" }, { supportedAssets: ["BTC", "ETH"] });
    expect(f[0]).toMatchObject({ field: "asset", code: "INVALID_ASSET" });
  });

  it("only ever emits canonical error codes", () => {
    const allowed = new Set([
      "INVALID_ASSET",
      "INVALID_DIRECTION",
      "INVALID_PRICE",
      "INVALID_POSITION_SIZE",
      "INVALID_LEVERAGE",
      "INSUFFICIENT_MARGIN",
      "SLIPPAGE_EXCEEDED",
    ]);
    const failures = validatePlan(
      { ...base, leverage: "999", stopLoss: "120000", takeProfit: "110000", expiresAt: "2020-01-01T00:00:00Z" },
      { now: NOW },
    );
    for (const f of failures) expect(allowed.has(f.code)).toBe(true);
  });
});