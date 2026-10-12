/**
 * Simulated builder-fee math.
 *
 * Every fee surface is labelled simulated: mock executions accrue a
 * hypothetical builder fee (5 bps on sizeUsd x leverage, split 50/50
 * creator/protocol) into `fee_ledger`. No real fees are charged by PASS —
 * live Hyperliquid builder fees are a separate, unwired concern.
 */

export const BUILDER_FEE_BPS = 5;
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
