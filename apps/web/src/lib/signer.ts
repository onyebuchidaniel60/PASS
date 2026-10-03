"use client";

/**
 * Client-side Hyperliquid signing.
 *
 * SECURITY RULES enforced here (docs/DECISIONS.md D-018.3/D-018.9,
 * docs/SECURITY_SPEC.md §2-§4, AGENTS.md):
 *
 *  - The agent private key is generated in the browser and never leaves it.
 *  - It is NEVER sent to the API and NEVER written to localStorage or any
 *    persistent store. It lives in a module-scoped variable for the session
 *    only.
 *  - The API receives a signed payload, which is not secret material.
 *
 * The mock implementation below produces a correctly shaped envelope so the
 * whole flow is walkable without credentials. The live implementation is
 * deliberately gated: see docs/INTEGRATION_VERIFICATION.md for the recorded
 * gap and the exact package required.
 */

export interface SignedPayload {
  exchangeRequest: Record<string, unknown>;
  signature: Record<string, unknown>;
}

export interface OrderIntent {
  asset: string;
  isBuy: boolean;
  size: string;
  limitPx: string;
  leverage: number;
  reduceOnly: boolean;
}

/** Ephemeral, session-scoped. Not persisted anywhere. */
let sessionAgentPrivateKey: string | null = null;

export function hasSessionAgentKey(): boolean {
  return sessionAgentPrivateKey !== null;
}

/**
 * Generates a fresh agent/API wallet key pair in the browser.
 * Hyperliquid docs call these API wallets / agent wallets; the master account
 * approves them via approveAgent.
 */
export async function generateSessionAgentWallet(): Promise<string> {
  // Browser-native secp256k1 is not exposed by Web Crypto, so this uses a
  // random 32-byte hex secret. It is a signer only and never authorises
  // anything until the master account approves its address.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  sessionAgentPrivateKey = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return sessionAgentPrivateKey;
}

export function agentAddressPlaceholder(): string {
  return "0xagent";
}

function nonce(): number {
  return Date.now();
}

/** Builds the L1 action payload the client signs. */
export function buildExchangeRequest(intent: OrderIntent): Record<string, unknown> {
  return {
    type: "order",
    action: {
      type: intent.isBuy ? "buy" : "sell",
      coin: intent.asset,
      isCross: true,
      sz: intent.size,
      limitPx: intent.limitPx,
      reduceOnly: intent.reduceOnly,
      leverage: intent.leverage,
    },
    nonce: nonce(),
    timestamp: Date.now(),
  };
}

/**
 * Signs the exchange request in the client.
 *
 * `mode: "mock"` produces a deterministic, non-secret placeholder signature
 * so the relay path, validation order, and idempotency can be exercised end
 * to end. `mode: "live"` refuses until the official SDK is wired in — it does
 * not silently produce an unsigned or fake-signed order for real funds.
 */
export async function signExchangeRequest(
  mode: "mock" | "live",
  request: Record<string, unknown>,
): Promise<SignedPayload> {
  if (mode === "live") {
    throw new Error(
      "Live client-side signing is not yet wired. Install the official Hyperliquid " +
        "SDK (`hyperliquid` + `viem`) and implement signExchangeRequest with it. " +
        "See docs/INTEGRATION_VERIFICATION.md. Set HYPERLIQUID_MODE=mock to use the " +
        "simulated relay path.",
    );
  }

  // Deterministic placeholder derived from the payload. This is NOT a
  // cryptographic signature and must never be sent to a live exchange.
  const src = JSON.stringify(request);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < src.length; i += 1) {
    h1 ^= src.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
  }
  const hex = (seed: number, len: number) => {
    let out = "";
    let s = seed >>> 0;
    for (let i = 0; i < len; i += 1) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      out += s.toString(16).padStart(8, "0").slice(0, 2);
    }
    return out;
  };

  return {
    exchangeRequest: request,
    signature: {
      r: `0x${hex(h1, 32)}`,
      s: `0x${hex(h1 ^ 0x9e3779b9, 32)}`,
      v: 27,
      mock: true,
    },
  };
}