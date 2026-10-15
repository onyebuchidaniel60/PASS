"use client";

import { DEFAULT_SLIPPAGE_TOLERANCE_BPS } from "@pass/contracts";

import { buildOrderAction } from "./hyperliquid";

/**
 * Take-order numbers (docs/DECISIONS.md D-025).
 *
 * Pure helpers so the preview and the submit provably use the same numbers:
 * the component computes them once per render through `takeNumbers()` and
 * both the step-2 display and `authorize()` consume that single result.
 */

/** D-025.1: limit Passes use the authored entry; market Passes use mid. */
export function resolveEntryPrice(params: {
  entryType: "limit" | "market";
  entryPrice: string | null;
  midPrice: string | null;
}): string | null {
  if (params.entryType === "limit") {
    return params.entryPrice && params.entryPrice.trim() !== "" ? params.entryPrice : null;
  }
  return params.midPrice && params.midPrice.trim() !== "" ? params.midPrice : null;
}

export function entrySourceLabel(entryType: "limit" | "market"): "Pass limit" | "Current mid" {
  return entryType === "limit" ? "Pass limit" : "Current mid";
}

/**
 * Allowed price decimals for an asset, from its own szDecimals at runtime.
 *
 * Hyperliquid's tick rule (docs "Tick and lot size", verified): a perp price
 * carries at most 5 significant figures AND at most (6 - szDecimals)
 * decimals (8 for spot). Integers are always allowed. No per-asset
 * constant anywhere: the asset's universe szDecimals is the only input
 * besides the reference price's magnitude.
 */
export function tickDecimalsFor(
  szDecimals: number | null | undefined,
  refPrice: number,
  maxDecimalsBase = 6,
): number | null {
  if (
    szDecimals === null ||
    szDecimals === undefined ||
    !Number.isInteger(szDecimals) ||
    szDecimals < 0
  )
    return null;
  if (!Number.isFinite(refPrice) || refPrice <= 0) return null;
  const byTick = Math.max(0, maxDecimalsBase - szDecimals);
  // 5 significant figures: decimals = 4 - floor(log10(v)), floored at 0
  // (large values become integers, which the venue always allows).
  const bySigFigs = Math.max(0, 4 - Math.floor(Math.log10(refPrice)));
  return Math.min(byTick, bySigFigs);
}

/**
 * Marketable price for a market entry (Hyperliquid has no native market
 * order). The mid ± the preview's slippage tolerance, ROUNDED (not
 * truncated) to the asset's tick, then nudged one tick away from the mid
 * when rounding would land on or across it — the result is always strictly
 * aggressive (above mid for a buy, below for a sell) AND always a multiple
 * of the tick, so an Ioc entry fills instead of resting or rejecting with
 * "Price must be divisible by tick size". Trailing zeros are stripped per
 * the signing doc. Returns null when the mid or szDecimals is unusable.
 * Pure math, no network.
 */
export function marketablePrice(params: {
  midPrice: string | null;
  isBuy: boolean;
  slippageToleranceBps?: number;
  /** Per-asset size decimals from the Info API universe. Drives the tick. */
  szDecimals: number | null | undefined;
}): string | null {
  const raw = (params.midPrice ?? "").trim();
  const mid = Number(raw);
  const bps = params.slippageToleranceBps ?? DEFAULT_SLIPPAGE_TOLERANCE_BPS;
  if (!raw || !Number.isFinite(mid) || mid <= 0) return null;
  if (!Number.isFinite(bps) || bps < 0) return null;
  const factor = params.isBuy ? 1 + bps / 10_000 : 1 - bps / 10_000;
  if (!(factor > 0)) return null;
  const decimals = tickDecimalsFor(params.szDecimals, mid * factor);
  if (decimals === null) return null;
  const quantum = 10 ** -decimals;
  // ±1e-9 absorbs float dust (113500 * 1.005 === 114067.49999999999, which
  // would round the wrong way) without ever pushing a true value across a
  // tick: the nudge points away from the mid, same direction as the trade.
  const dust = params.isBuy ? 1e-9 : -1e-9;
  let px = Number((mid * factor + dust).toFixed(decimals));
  // Rounding may land exactly on the mid (or, pathologically, across it):
  // nudge one tick so the price stays strictly marketable. A whole-tick
  // nudge keeps the value tick-divisible by construction.
  if (params.isBuy && !(px > mid)) px = Number((px + quantum).toFixed(decimals));
  if (!params.isBuy && !(px < mid)) px = Number((px - quantum).toFixed(decimals));
  if (!Number.isFinite(px) || px <= 0) return null;
  // Fail closed: the final value MUST be an integer multiple of the tick.
  if (Math.abs(px * 10 ** decimals - Math.round(px * 10 ** decimals)) > 1e-6) {
    return null;
  }
  return stripTrailingZeros(px.toFixed(decimals));
}

/** "151.00" -> "151": same value, fewer decimals, per the signing doc. */
function stripTrailingZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/**
 * D-025.2: baseSize = sizeUsd / entryPrice, floored to the asset's
 * szDecimals. Never rounds up: rounding up would overshoot the Taker's
 * chosen notional. Returns null when the inputs are unusable (non-positive
 * size or price, negative decimals) or the floored size is zero — a zero
 * size must never be signed.
 */
export function floorBaseSize(
  sizeUsd: number,
  entryPrice: string,
  szDecimals: number,
): string | null {
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return null;
  const px = Number(entryPrice);
  if (!Number.isFinite(px) || px <= 0) return null;
  if (!Number.isInteger(szDecimals) || szDecimals < 0) return null;
  const factor = 10 ** szDecimals;
  // +1e-9 absorbs float dust (e.g. 0.29*100 === 28.9999999) without ever
  // pushing a true value up: the floor still truncates toward zero.
  const floored = Math.floor((sizeUsd / px) * factor + 1e-9) / factor;
  if (!(floored > 0)) return null;
  return floored.toFixed(szDecimals);
}

/** Idempotency key for POST /passes/{id}/executions (D-018.3 step 5). */
export function newClientRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") {
    return `req_${c.randomUUID().replace(/-/g, "")}`;
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `req_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The bracket the venue receives: entry plus the Pass's own exits in one
 * `grouping: "normalTpsl"` action. Exits are reduce-only and trigger-market
 * (see `buildOrderAction`); the entry never is.
 */
export function buildTakeAction(params: {
  assetIndex: number;
  isBuy: boolean;
  entryPrice: string;
  baseSize: string;
  takeProfit: string | null;
  stopLoss: string | null;
  /** Entry time-in-force. Defaults to Gtc (limit semantics); market entries pass Ioc. */
  tif?: "Alo" | "Ioc" | "Gtc";
}) {
  return buildOrderAction({
    assetIndex: params.assetIndex,
    isBuy: params.isBuy,
    price: params.entryPrice,
    size: params.baseSize,
    reduceOnly: false,
    tif: params.tif ?? "Gtc",
    grouping: "normalTpsl",
    takeProfit: params.takeProfit,
    stopLoss: params.stopLoss,
  });
}

/** Exact POST body for /passes/{id}/executions. No `signedAction`. */
export function executionBody(params: {
  passVersion: number;
  /** Owned row (signed-in path). Exactly one of the two (D-026). */
  accountId?: string;
  /** Wallet address (anonymous path). Exactly one of the two (D-026). */
  accountAddress?: string;
  clientRequestId: string;
  signedPayload: { exchangeRequest: Record<string, unknown>; signature: Record<string, unknown> };
  /**
   * Taker's chosen size in USDC and leverage, as shown on the Take screen.
   * Fee computation only — the server executes from `signedPayload`, never
   * from these. Omitted callers keep the exact legacy body.
   */
  positionSize?: string;
  leverage?: string;
}) {
  return {
    passVersion: params.passVersion,
    ...(params.accountId
      ? { accountId: params.accountId }
      : { accountAddress: params.accountAddress }),
    clientRequestId: params.clientRequestId,
    ...(params.positionSize !== undefined ? { positionSize: params.positionSize } : {}),
    ...(params.leverage !== undefined ? { leverage: params.leverage } : {}),
    signedPayload: params.signedPayload,
  };
}

/** Removed with the custom wallet tile list (Item 10): the Take flow opens
 * ConnectKit's own modal now, which owns connect-error rendering. */
