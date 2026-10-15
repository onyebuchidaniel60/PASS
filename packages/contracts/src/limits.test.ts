import { describe, expect, it } from "vitest";

import { CreatePassRequest, ExecutionPreviewRequest } from "./pass.js";
import {
  DEFAULT_SLIPPAGE_TOLERANCE_BPS,
  MAX_LEVERAGE,
  MIN_ORDER_VALUE_USD,
} from "./limits.js";

const BASE_PASS = {
  asset: "BTC",
  direction: "long",
  entryType: "limit",
  entryPrice: "113400",
  stopLoss: "111900",
  takeProfit: "116000",
  thesis: "Range top reclaim.",
  expiresAt: "2099-01-01T00:00:00.000Z",
} as const;

const PREVIEW_BASE = {
  passVersion: 1,
  accountAddress: "0x000000000000000000000000000000000000d3a0",
  positionSize: "100",
  slippageToleranceBps: 50,
} as const;

describe("shared venue limits", () => {
  it("pins the $10 minimum and the 10x ceiling", () => {
    expect(MIN_ORDER_VALUE_USD).toBe(10);
    expect(MAX_LEVERAGE).toBe(10);
  });

  it("pins the 50bps market-entry slippage tolerance", () => {
    expect(DEFAULT_SLIPPAGE_TOLERANCE_BPS).toBe(50);
  });

  it("rejects CreatePass leverage above 10 at the API schema", () => {
    expect(
      CreatePassRequest.safeParse({ ...BASE_PASS, leverage: "11" }).success,
    ).toBe(false);
    expect(
      CreatePassRequest.safeParse({ ...BASE_PASS, leverage: "10" }).success,
    ).toBe(true);
  });

  it("rejects preview leverage above 10 at the API schema", () => {
    expect(
      ExecutionPreviewRequest.safeParse({ ...PREVIEW_BASE, leverage: "11" })
        .success,
    ).toBe(false);
    expect(
      ExecutionPreviewRequest.safeParse({ ...PREVIEW_BASE, leverage: "10" })
        .success,
    ).toBe(true);
  });
});
