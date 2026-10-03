import { z } from "zod";
import { DecimalString, IsoDateTime, RunMode } from "./common.js";

/**
 * Normalized provider DTOs. Provider payloads are normalized at the
 * integration boundary and never reach domain or UI code raw
 * (docs/TECHNICAL_SPEC.md §6, docs/API_CONTRACTS.md §10).
 *
 * Field names are derived from provider docs recorded in
 * docs/INTEGRATION_VERIFICATION.md. Do not invent provider fields.
 */

export const HLAssetMeta = z.object({
  asset: z.string(),
  /** Perp dex name. Hyperliquid perp DEXs are typically "perp". */
  dex: z.string(),
  assetId: z.number().int(),
  /** Provider-reported decimals for prices. */
  szDecimals: z.number().int().optional(),
  maxLeverage: z.number().int().optional(),
});
export type HLAssetMeta = z.infer<typeof HLAssetMeta>;

export const HLOrderBookLevel = z.object({
  price: DecimalString,
  size: DecimalString,
});
export type HLOrderBookLevel = z.infer<typeof HLOrderBookLevel>;

export const HLOrderBook = z.object({
  asset: z.string(),
  levels: z.array(HLOrderBookLevel),
  observedAt: IsoDateTime,
});
export type HLOrderBook = z.infer<typeof HLOrderBook>;

/**
 * Account state. Always queried with account_address, never agent_address
 * (docs/DECISIONS.md D-018.3, docs/TECHNICAL_SPEC.md §8).
 */
export const HLAccountState = z.object({
  accountAddress: z.string(),
  accountValue: DecimalString.nullable(),
  withdrawable: DecimalString.nullable(),
  marginUsed: DecimalString.nullable(),
  observedAt: IsoDateTime,
});
export type HLAccountState = z.infer<typeof HLAccountState>;

export const HLOrder = z.object({
  oid: z.number().int(),
  coin: z.string(),
  side: z.enum(["buy", "sell"]),
  limitPx: DecimalString,
  sz: DecimalString,
  reduceOnly: z.boolean(),
  orderType: z.string().nullable(),
});
export type HLOrder = z.infer<typeof HLOrder>;

export const HLOpenOrder = z.object({
  accountAddress: z.string(),
  orders: z.array(HLOrder),
  observedAt: IsoDateTime,
});
export type HLOpenOrder = z.infer<typeof HLOpenOrder>;

export const HLFill = z.object({
  accountAddress: z.string(),
  coin: z.string(),
  side: z.enum(["buy", "sell"]),
  px: DecimalString,
  sz: DecimalString,
  time: z.number().int(),
  oid: z.number().int().nullable(),
  closedPnl: DecimalString.nullable(),
  fee: DecimalString.nullable(),
  dir: z.string().nullable(),
});
export type HLFill = z.infer<typeof HLFill>;

export const HLOrderStatus = z.object({
  /** Hyperliquid statuses: open, filled, canceled, rejected, marginCanceled. */
  status: z.string(),
  orderId: z.string(),
  oid: z.number().int().nullable(),
  filled: z.boolean().nullable(),
  avgPx: DecimalString.nullable(),
  totalSz: DecimalString.nullable(),
});
export type HLOrderStatus = z.infer<typeof HLOrderStatus>;

/** Relay result. Contains no key material, ever. */
export const HLRelayResult = z.object({
  providerOrderId: z.string(),
  status: z.string(),
  rawStatus: z.unknown().optional(),
});
export type HLRelayResult = z.infer<typeof HLRelayResult>;

export const XUser = z.object({
  xUserId: z.string(),
  handle: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type XUser = z.infer<typeof XUser>;

export const XPostResult = z.object({
  postId: z.string(),
  text: z.string(),
  url: z.string().nullable(),
});
export type XPostResult = z.infer<typeof XPostResult>;

export const EthosReputation = z.object({
  providerProfileId: z.string().nullable(),
  credibilityScore: z.number().nullable(),
  reviewsCount: z.number().int().nullable(),
  vouchesCount: z.number().int().nullable(),
  humanVerified: z.boolean().nullable(),
  sourceUrl: z.string().nullable(),
  syncedAt: IsoDateTime,
});
export type EthosReputation = z.infer<typeof EthosReputation>;

/** Which mode each provider adapter resolved to at startup. */
export const AdapterModes = z.object({
  hyperliquid: RunMode,
  ethos: RunMode,
  x: RunMode,
  database: RunMode,
});
export type AdapterModes = z.infer<typeof AdapterModes>;