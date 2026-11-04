import type { MarketClass, PassEntryType } from "@pass/contracts";

/**
 * Minimal market-class boundary (HIP-4 additive market class).
 *
 * PASS historically assumed one market shape: a Hyperliquid perp quoted in
 * USDC. HIP-4 outcome markets differ in every place that matters to an order:
 *
 *  - the wire coin is `#N`, not a perp name;
 *  - the balance token is `+N`;
 *  - the asset id is `100_000_000 + N`;
 *  - collateral is USDH, not USDC;
 *  - there is no leverage, no liquidation, no TP/SL;
 *  - price is a probability (0.001–0.999, 3 decimals);
 *  - the order action must not carry `reduceOnly` and uses grouping `"na"`.
 *
 * Encoding rule (Hyperliquid asset-ids docs):
 *
 *   N = 10 * outcome_id + side      side 0 = YES, side 1 = NO
 *
 * This module keeps those differences in three implementations of ONE
 * interface, so business code asks a market for its own order shape instead of
 * branching on `marketClass` at every call site. Pure and network-free.
 */

export const HIP4_ASSET_ID_OFFSET = 100_000_000;
export const HIP4_COLLATERAL = "USDH" as const;
export const HIP4_MIN_PRICE = 0.001;
export const HIP4_MAX_PRICE = 0.999;
export const HIP4_PRICE_DECIMALS = 3;
/**
 * Outcome token size decimals are NOT published by `outcomeMeta`, and outcome
 * tokens do not appear in `spotMeta` (verified against live testnet/mainnet on
 * 2026-10-30). Two decimals is the conservative venue-compatible default;
 * callers that learn a different value from the venue pass it through.
 * Recorded as an open item in docs/INTEGRATION_VERIFICATION.md.
 */
export const HIP4_DEFAULT_SZ_DECIMALS = 2;

export type OutcomeSide = 0 | 1;
export type OutcomeSideName = "yes" | "no";

export interface OutcomeEncoding {
  outcomeId: number;
  side: OutcomeSide;
  sideName: OutcomeSideName;
  /** 10 * outcomeId + side; the value encoded in all three representations. */
  encoding: number;
  /** Order / book coin: `#<encoding>`. */
  orderCoin: string;
  /** Balance token name: `+<encoding>`. */
  balanceCoin: string;
  /** Order asset id: 100_000_000 + encoding. */
  assetId: number;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/** Encode an outcome id plus side into every representation the API uses. */
export function encodeOutcome(
  outcomeId: number,
  side: OutcomeSide,
): OutcomeEncoding | null {
  if (!isNonNegativeInt(outcomeId) || (side !== 0 && side !== 1)) return null;
  const encoding = 10 * outcomeId + side;
  return {
    outcomeId,
    side,
    sideName: side === 0 ? "yes" : "no",
    encoding,
    orderCoin: `#${encoding}`,
    balanceCoin: `+${encoding}`,
    assetId: HIP4_ASSET_ID_OFFSET + encoding,
  };
}

/**
 * Decode `#N`, `+N`, or a bare encoding. Returns null for anything that is not
 * a valid outcome encoding (including encodings whose side digit is not 0/1).
 */
export function decodeOutcomeCoin(coin: string): OutcomeEncoding | null {
  const raw = String(coin ?? "").trim();
  if (!raw) return null;
  const digits = raw.startsWith("#") || raw.startsWith("+") ? raw.slice(1) : raw;
  if (!/^\d+$/.test(digits)) return null;
  const encoding = Number(digits);
  if (!Number.isSafeInteger(encoding) || encoding < 0) return null;
  const side = encoding % 10;
  if (side !== 0 && side !== 1) return null;
  return encodeOutcome(Math.floor(encoding / 10), side as OutcomeSide);
}

/** True for the three accepted outcome representations. */
export function isOutcomeCoin(coin: string): boolean {
  return decodeOutcomeCoin(coin) !== null;
}

/** Classify a coin string when the caller did not state a class. */
export function inferMarketClass(asset: string): MarketClass {
  const value = String(asset ?? "").trim();
  if (value.startsWith("#") || value.startsWith("+")) return "hip4";
  if (value.startsWith("@") || value.includes("/")) return "spot";
  return "perp";
}

export interface MarketResolveInput {
  asset: string;
  marketClass?: MarketClass | null;
  assetIndex?: number | null;
  szDecimals?: number | null;
  maxLeverage?: number | null;
  /** Venue-reported collateral/quote token, when known. Diagnostics only. */
  quoteToken?: string | null;
}

export type CoinOrPass = string | MarketResolveInput;

export interface MarketResolution {
  assetClass: MarketClass;
  assetIndex: number;
  /** The coin string used by orders and books. */
  coinString: string;
  /** The token name used by balances. Equals coinString outside HIP-4. */
  balanceCoin: string;
  szDecimals: number | null;
  maxLeverage: number | null;
  /** Collateral token PASS expects for this class. */
  collateral: string;
  /** Venue-reported quote token when it differs from `collateral`. */
  venueQuoteToken: string | null;
  outcome: OutcomeEncoding | null;
}

export interface ResolveMarketOptions {
  /** Fallback size decimals for HIP-4 when the venue does not publish them. */
  outcomeSzDecimals?: number | null;
}

function normalizeInput(input: CoinOrPass): MarketResolveInput {
  return typeof input === "string" ? { asset: input } : input;
}

function venueQuoteToken(input: MarketResolveInput, collateral: string): string | null {
  const quote = input.quoteToken?.trim();
  if (!quote) return null;
  return quote.toUpperCase() === collateral.toUpperCase() ? null : quote;
}

function resolveHip4(
  input: MarketResolveInput,
  opts: ResolveMarketOptions,
): MarketResolution | null {
  const decoded =
    decodeOutcomeCoin(input.asset) ??
    (typeof input.assetIndex === "number" &&
    input.assetIndex >= HIP4_ASSET_ID_OFFSET
      ? decodeOutcomeCoin(String(input.assetIndex - HIP4_ASSET_ID_OFFSET))
      : null);
  if (!decoded) return null;
  const sz =
    typeof input.szDecimals === "number" && Number.isInteger(input.szDecimals)
      ? input.szDecimals
      : typeof opts.outcomeSzDecimals === "number" &&
          Number.isInteger(opts.outcomeSzDecimals)
        ? opts.outcomeSzDecimals
        : HIP4_DEFAULT_SZ_DECIMALS;
  return {
    assetClass: "hip4",
    assetIndex: decoded.assetId,
    coinString: decoded.orderCoin,
    balanceCoin: decoded.balanceCoin,
    szDecimals: sz,
    maxLeverage: null,
    collateral: HIP4_COLLATERAL,
    venueQuoteToken: venueQuoteToken(input, HIP4_COLLATERAL),
    outcome: decoded,
  };
}

function resolvePerp(input: MarketResolveInput): MarketResolution | null {
  if (typeof input.assetIndex !== "number" || !Number.isInteger(input.assetIndex)) {
    return null;
  }
  const coin = input.asset.trim().toUpperCase();
  if (!coin) return null;
  return {
    assetClass: "perp",
    assetIndex: input.assetIndex,
    coinString: coin,
    balanceCoin: coin,
    szDecimals:
      typeof input.szDecimals === "number" && Number.isInteger(input.szDecimals)
        ? input.szDecimals
        : null,
    maxLeverage:
      typeof input.maxLeverage === "number" && Number.isInteger(input.maxLeverage)
        ? input.maxLeverage
        : null,
    collateral: "USDC",
    venueQuoteToken: venueQuoteToken(input, "USDC"),
    outcome: null,
  };
}

function resolveSpot(input: MarketResolveInput): MarketResolution | null {
  const coin = input.asset.trim();
  if (!coin) return null;
  let index = input.assetIndex;
  if (typeof index !== "number" && coin.startsWith("@") && /^\d+$/.test(coin.slice(1))) {
    // Documented spot asset id: 10000 + spot pair index.
    index = 10_000 + Number(coin.slice(1));
  }
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  return {
    assetClass: "spot",
    assetIndex: index,
    coinString: coin,
    balanceCoin: coin,
    szDecimals:
      typeof input.szDecimals === "number" && Number.isInteger(input.szDecimals)
        ? input.szDecimals
        : null,
    maxLeverage: null,
    collateral: "USDC",
    venueQuoteToken: venueQuoteToken(input, "USDC"),
    outcome: null,
  };
}

export type OrderTif = "Alo" | "Ioc" | "Gtc";

export interface LimitOrderType {
  limit: { tif: OrderTif };
}

export interface TriggerOrderType {
  trigger: { isMarket: true; triggerPx: string; tpsl: "tp" | "sl" };
}

export interface MarketOrderLeg {
  a: number;
  b: boolean;
  p: string;
  s: string;
  /** HIP-4 legs omit the field entirely (the venue rejects reduceOnly there). */
  r?: boolean;
  t: LimitOrderType | TriggerOrderType;
}

export type OrderGrouping = "na" | "normalTpsl" | "positionTpsl";

export interface MarketOrderAction {
  type: "order";
  orders: MarketOrderLeg[];
  grouping: OrderGrouping;
}

export interface BuildEntryOrderInput {
  isBuy: boolean;
  price: string;
  size: string;
  tif?: OrderTif;
  /** Perp/spot only. HIP-4 ignores it. */
  reduceOnly?: boolean;
}

export interface BuildExitOrderInput {
  /** The entry side. Exits are placed on the opposite side. */
  isBuy: boolean;
  size: string;
  takeProfit?: string | null;
  stopLoss?: string | null;
}

export interface MarketClassAdapter {
  readonly assetClass: MarketClass;
  resolve(
    input: MarketResolveInput,
    opts: ResolveMarketOptions,
  ): MarketResolution | null;
  buildEntryOrder(
    market: MarketResolution,
    input: BuildEntryOrderInput,
  ): MarketOrderLeg;
  /** HIP-4 has no venue exits: returns an empty list by construction. */
  buildExits(
    market: MarketResolution,
    input: BuildExitOrderInput,
  ): MarketOrderLeg[];
}

const perpMarketAdapter: MarketClassAdapter = {
  assetClass: "perp",
  resolve: resolvePerp,
  buildEntryOrder(market, input) {
    return {
      a: market.assetIndex,
      b: input.isBuy,
      p: input.price,
      s: input.size,
      r: input.reduceOnly ?? false,
      t: { limit: { tif: input.tif ?? "Gtc" } },
    };
  },
  buildExits(market, input) {
    const legs: MarketOrderLeg[] = [];
    const exitSide = !input.isBuy;
    if (input.takeProfit) {
      legs.push({
        a: market.assetIndex,
        b: exitSide,
        p: input.takeProfit,
        s: input.size,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: input.takeProfit, tpsl: "tp" } },
      });
    }
    if (input.stopLoss) {
      legs.push({
        a: market.assetIndex,
        b: exitSide,
        p: input.stopLoss,
        s: input.size,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: input.stopLoss, tpsl: "sl" } },
      });
    }
    return legs;
  },
};

const spotMarketAdapter: MarketClassAdapter = {
  ...perpMarketAdapter,
  assetClass: "spot",
  resolve: resolveSpot,
};

const hip4MarketAdapter: MarketClassAdapter = {
  assetClass: "hip4",
  resolve: resolveHip4,
  buildEntryOrder(market, input) {
    // Deliberately no `r`. Hyperliquid's outcome order shape has no
    // reduceOnly field, and an explicit `r: false` is not the same wire shape.
    return {
      a: market.assetIndex,
      b: input.isBuy,
      p: input.price,
      s: input.size,
      t: { limit: { tif: input.tif ?? "Gtc" } },
    };
  },
  buildExits() {
    return [];
  },
};

const ADAPTERS: Record<MarketClass, MarketClassAdapter> = {
  perp: perpMarketAdapter,
  spot: spotMarketAdapter,
  hip4: hip4MarketAdapter,
};

export function marketAdapterFor(assetClass: MarketClass): MarketClassAdapter {
  return ADAPTERS[assetClass] ?? perpMarketAdapter;
}

/**
 * Resolve a coin string or a Pass-like object to the one shape every order
 * path needs. Unknown/incomplete perp/spot metadata resolves to null so a
 * caller fails closed instead of signing a made-up asset index.
 */
export function resolveMarket(
  coinOrPass: CoinOrPass,
  opts: ResolveMarketOptions = {},
): MarketResolution | null {
  const input = normalizeInput(coinOrPass);
  const assetClass = input.marketClass ?? inferMarketClass(input.asset);
  return marketAdapterFor(assetClass).resolve(input, opts);
}

/** Compose the full take action through the class adapter. */
export function buildTakeOrderAction(
  market: MarketResolution,
  input: BuildEntryOrderInput & BuildExitOrderInput,
): MarketOrderAction {
  const adapter = marketAdapterFor(market.assetClass);
  const entry = adapter.buildEntryOrder(market, input);
  const exits = adapter.buildExits(market, input);
  return {
    type: "order",
    orders: [entry, ...exits],
    grouping: exits.length > 0 ? "normalTpsl" : "na",
  };
}

/**
 * Probability price for a HIP-4 market entry. Mirrors `marketablePrice` for
 * perps but uses the outcome tick (0.001) and clamps into the tradable band.
 * Never equals the mid, so an Ioc entry fills instead of resting.
 */
export function marketableOutcomePrice(params: {
  midPrice: string | null;
  isBuy: boolean;
  slippageToleranceBps?: number;
}): string | null {
  const raw = (params.midPrice ?? "").trim();
  const mid = Number(raw);
  const bps = params.slippageToleranceBps ?? 50;
  if (!raw || !Number.isFinite(mid) || mid <= 0) return null;
  if (!Number.isFinite(bps) || bps < 0) return null;
  const factor = params.isBuy ? 1 + bps / 10_000 : 1 - bps / 10_000;
  if (!(factor > 0)) return null;
  const quantum = 10 ** -HIP4_PRICE_DECIMALS;
  const dust = params.isBuy ? 1e-9 : -1e-9;
  let px = Number((mid * factor + dust).toFixed(HIP4_PRICE_DECIMALS));
  if (params.isBuy && !(px > mid)) px = Number((px + quantum).toFixed(HIP4_PRICE_DECIMALS));
  if (!params.isBuy && !(px < mid)) px = Number((px - quantum).toFixed(HIP4_PRICE_DECIMALS));
  px = Math.min(HIP4_MAX_PRICE, Math.max(HIP4_MIN_PRICE, px));
  if (!Number.isFinite(px) || px <= 0) return null;
  return px.toFixed(HIP4_PRICE_DECIMALS).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Validation helper: HIP-4 plans are market-entry only, in USDH, with no
 * leverage and no venue exits. Kept next to the encoding so the API, form and
 * tests share one definition of "a valid outcome Pass".
 */
export function isOutcomePlanShape(plan: {
  asset: string;
  entryType: PassEntryType;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  leverage: string | null;
}): boolean {
  return (
    isOutcomeCoin(plan.asset) &&
    plan.entryType === "market" &&
    plan.entryPrice === null &&
    plan.stopLoss === null &&
    plan.takeProfit === null &&
    plan.leverage === null
  );
}
