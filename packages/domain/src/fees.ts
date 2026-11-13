/**
 * Builder-fee math.
 *
 * Mock executions accrue a hypothetical builder fee (5 bps on sizeUsd x
 * leverage, split 50/50 creator/protocol) into `fee_ledger` for UI
 * disclosure. Live orders carry the same 5 bps (f=50 tenths of a bp) in the
 * Hyperliquid order action's `builder` field, and the master wallet approves
 * that rate once via `approveBuilderFee`.
 */

export const BUILDER_FEE_BPS = 5;
/**
 * Hyperliquid's order `builder.f` and `approveBuilderFee` use tenths of a
 * basis point: 50 = 5 bps = 0.05%.
 */
export const BUILDER_FEE_TENTHS_BPS = BUILDER_FEE_BPS * 10;
/** Percent string required by the approveBuilderFee action, e.g. "0.05%". */
export const BUILDER_FEE_RATE_PERCENT = `${BUILDER_FEE_BPS / 100}%`;
export const CREATOR_SHARE_PCT = 50;
export const PROTOCOL_SHARE_PCT = 50;

export function computeFee(notionalUsd: number): number {
  return notionalUsd * (BUILDER_FEE_BPS / 10_000);
}
export function splitFee(feeUsd: number) {
  return {
    creatorShareUsd: feeUsd * (CREATOR_SHARE_PCT / 100),
    protocolShareUsd: feeUsd * (PROTOCOL_SHARE_PCT / 100),
  };
}
