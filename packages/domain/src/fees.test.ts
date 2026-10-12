import { describe, expect, it } from "vitest";

import {
  BUILDER_FEE_BPS,
  CREATOR_SHARE_PCT,
  PROTOCOL_SHARE_PCT,
  computeFee,
  splitFee,
} from "./fees.js";

describe("simulated builder fees", () => {
  it("computeFee charges 5 bps of notional", () => {
    expect(BUILDER_FEE_BPS).toBe(5);
    // Operator walk: size 100 at 2x = 200 notional -> 0.10 fee.
    expect(computeFee(200)).toBeCloseTo(0.1, 10);
    expect(computeFee(1000)).toBeCloseTo(0.5, 10);
  });

  it("splitFee divides 50/50 creator/protocol", () => {
    expect(CREATOR_SHARE_PCT).toBe(50);
    expect(PROTOCOL_SHARE_PCT).toBe(50);
    expect(splitFee(0.1)).toEqual({ creatorShareUsd: 0.05, protocolShareUsd: 0.05 });
  });

  it("zero notional yields zero fees", () => {
    expect(computeFee(0)).toBe(0);
    expect(splitFee(0)).toEqual({ creatorShareUsd: 0, protocolShareUsd: 0 });
  });

  it("rounds dust, never inventing money", () => {
    // 10 notional -> 0.005 fee -> 0.0025 each; float dust must not leak
    // into the ledger beyond 8dp.
    const fee = computeFee(10);
    expect(fee).toBeCloseTo(0.005, 10);
    const split = splitFee(fee);
    expect(split.creatorShareUsd + split.protocolShareUsd).toBeCloseTo(fee, 10);
    for (const v of [fee, split.creatorShareUsd, split.protocolShareUsd]) {
      expect(Math.round(v * 1e8) / 1e8).toBeCloseTo(v, 8);
    }
  });
});
