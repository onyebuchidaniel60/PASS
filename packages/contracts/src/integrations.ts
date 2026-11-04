import { z } from "zod";
import {
  DecimalString,
  IsoDateTime,
  MarketClass,
  OutcomeRef,
  RunMode,
} from "./common.js";

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
  /** Perp dex name, "spot", or "hip4" for an outcome market. */
  dex: z.string(),
  /** Market class. Absent on legacy perp payloads: treat as perp. */
  marketClass: MarketClass.optional(),
  assetId: z.number().int(),
  /** Provider-reported decimals for prices. */
  szDecimals: z.number().int().optional(),
  /** Null/absent for HIP-4: outcome markets have no leverage. */
  maxLeverage: z.number().int().nullable().optional(),
  /** Collateral token the market settles in. USDH for HIP-4. */
  collateral: z.string().optional(),
  /** `+N` balance token for HIP-4; the order coin otherwise. */
  balanceCoin: z.string().optional(),
  /** Venue-reported quote/collateral token, when it differs from PASS's. */
  venueQuoteToken: z.string().nullable().optional(),
  /** HIP-4 side context. Null/absent for perp/spot. */
  outcome: OutcomeRef.nullable().optional(),
});
export type HLAssetMeta = z.infer<typeof HLAssetMeta>;

/**
 * One outcome as returned by `POST /info {type:"outcomeMeta"}`.
 * The live API (verified 2026-10-30) also reports `quoteToken` and `venue`;
 * these are diagnostics, not the collateral PASS assumes for HIP-4.
 */
export const HLOutcomeMeta = z.object({
  outcomeId: z.number().int().nonnegative(),
  name: z.string(),
  description: z.string().nullable(),
  /** Venue-reported quote token. PASS expects USDH for HIP-4 (HIP-4 spec). */
  quoteToken: z.string().nullable(),
  venue: z.string().nullable(),
  /** Side labels as the venue publishes them, e.g. ["Yes", "No"]. */
  sideNames: z.tuple([z.string(), z.string()]).nullable(),
});
export type HLOutcomeMeta = z.infer<typeof HLOutcomeMeta>;

/** One token balance from `spotClearinghouseState`. */
export const HLSpotBalance = z.object({
  token: z.string(),
  total: DecimalString,
  hold: DecimalString,
  /** total - hold, non-negative. */
  available: DecimalString,
});
export type HLSpotBalance = z.infer<typeof HLSpotBalance>;

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
  /**
   * True when the relay was simulated (HYPERLIQUID_MODE=mock). The mock
   * branches set this with a `mock_<uuid>` provider id and status `pending`
   * and make no network call. Live relays set false (or leave undefined,
   * treated as false).
   */
  simulated: z.boolean().optional(),
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
  /**
   * The COMBINED Hyperliquid mode: "live" only when reads AND execution are
   * both live. Kept so existing consumers keep compiling and so a caller that
   * only cares "is this venue real" gets the conservative answer.
   */
  hyperliquid: RunMode,
  /**
   * Read paths only (Info API: mids, books, account state, fills). Split from
   * `hyperliquid` by D-021 so "live prices, no execution" is representable and
   * visible rather than implied.
   */
  hyperliquidReads: RunMode,
  /** Write paths only (order relay, agent approval). Gated by HYPERLIQUID_MODE. */
  hyperliquidExecution: RunMode,
  ethos: RunMode,
  x: RunMode,
  database: RunMode,
});
export type AdapterModes = z.infer<typeof AdapterModes>;