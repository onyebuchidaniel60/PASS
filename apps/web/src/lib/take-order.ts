"use client";

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
}) {
  return buildOrderAction({
    assetIndex: params.assetIndex,
    isBuy: params.isBuy,
    price: params.entryPrice,
    size: params.baseSize,
    reduceOnly: false,
    tif: "Gtc",
    grouping: "normalTpsl",
    takeProfit: params.takeProfit,
    stopLoss: params.stopLoss,
  });
}

/** Exact POST body for /passes/{id}/executions. No `signedAction`. */
export function executionBody(params: {
  passVersion: number;
  accountId: string;
  clientRequestId: string;
  signedPayload: { exchangeRequest: Record<string, unknown>; signature: Record<string, unknown> };
}) {
  return {
    passVersion: params.passVersion,
    accountId: params.accountId,
    clientRequestId: params.clientRequestId,
    signedPayload: params.signedPayload,
  };
}

/**
 * A connect failure rendered specifically, never ConnectKit's generic
 * screen. Names the wallet and the cause: a rejection is the user's own
 * action, a chain problem is correctable in the wallet, a missing
 * provider means conflicting extensions, and anything else is quoted
 * verbatim rather than swallowed.
 */
export function connectFailureMessage(err: unknown, walletName: string): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const raw = err instanceof Error ? err.message : String(err);
  if (/UserRejected/i.test(name) || /rejected|denied|cancell?ed/i.test(raw)) {
    return `You rejected the connection in ${walletName}. Nothing was connected — try again when ready.`;
  }
  if (/ChainMismatch|ChainNotConfigured|ChainId|4902/.test(`${name} ${raw}`)) {
    return `${walletName} is on the wrong network. PASS signs on Arbitrum (chain 42161) — switch networks in ${walletName} and try again.`;
  }
  if (/ProviderNotFound/i.test(name)) {
    return `No ${walletName} provider was found, even though an extension seemed present. Disable conflicting wallet extensions so only one manages the browser provider, reload, and try again.`;
  }
  return `${walletName} could not connect: ${raw}`;
}
