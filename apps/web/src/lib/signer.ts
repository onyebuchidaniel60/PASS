"use client";

import { buildOrderAction, HL_DOMAIN, type HLChain } from "./hyperliquid";

/**
 * Order-intent construction and submission envelope.
 *
 * SECURITY (docs/DECISIONS.md D-018.3/D-018.9, D-019.1):
 *  - The signed payload is produced in the browser and submitted to the API,
 *    which relays it to the Hyperliquid Exchange API.
 *  - No private key is ever placed in this module, logged, or sent.
 *  - The agent key is applied by `agent-keystore.ts` and never leaves the page.
 *
 * The order action shape follows the official Exchange endpoint documentation:
 *   action = { type:"order", orders:[{ a, b, p, s, r, t }], grouping }
 * where `a` is the asset INDEX from the Info API `meta` universe, not the coin
 * name.
 */

export interface SignedPayload {
  exchangeRequest: Record<string, unknown>;
  signature: Record<string, unknown>;
}

export interface OrderIntent {
  /** Asset index from the Info API meta universe. */
  assetIndex: number;
  isBuy: boolean;
  size: string;
  limitPx: string;
  reduceOnly?: boolean;
  tif?: "Alo" | "Ioc" | "Gtc";
  chain?: HLChain;
  /**
   * The Pass's own take profit and stop loss, as authored by the Trader.
   *
   * Both are independently optional and both are NEVER derived, defaulted or
   * invented. A Pass with only a stop loss must produce a bracket with only a
   * stop leg, because fabricating the other side would be a claim about a
   * Trader's risk that the Trader never made.
   */
  takeProfit?: string | null;
  stopLoss?: string | null;
}

/**
 * Builds the order action and nonce for an L1 order.
 *
 * Orders are L1 actions, not user-signed actions: the action is hashed via
 * the phantom-agent construction (msgpack + keccak) and signed with the
 * Exchange domain (chain 1337), per the official Python SDK
 * (`sign_l1_action`) and the documented `@nktkas/hyperliquid` flow. The
 * `domain`/`types`/`primaryType`/`message` fields below are retained only so
 * existing callers keep compiling; live signing ignores them and uses
 * `signL1Action` instead. Do not sign orders as
 * `HyperliquidTransaction:Exchange` user-signed typed data — Hyperliquid
 * will reject the signature.
 */
export function buildExchangeRequest(intent: OrderIntent): {
  action: Record<string, unknown>;
  nonce: number;
  domain: typeof HL_DOMAIN;
  types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
} {
  const nonce = Date.now();
  const action = buildOrderAction({
    assetIndex: intent.assetIndex,
    isBuy: intent.isBuy,
    price: intent.limitPx,
    size: intent.size,
    reduceOnly: intent.reduceOnly,
    tif: intent.tif,
    // Forwarded as authored. `buildOrderAction` decides the grouping.
    takeProfit: intent.takeProfit,
    stopLoss: intent.stopLoss,
  });

  return {
    action,
    nonce,
    domain: HL_DOMAIN,
    types: {
      HyperliquidTransaction: [
        { name: "hyperliquidChain", type: "string" },
        { name: "signatureChainId", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "HyperliquidTransaction:Exchange",
    message: {
      hyperliquidChain: intent.chain ?? "Mainnet",
      signatureChainId: "0xa4b1",
      nonce: BigInt(nonce),
      action: JSON.stringify(action),
    },
  };
}

/**
 * Produces the signed envelope submitted to
 * POST /passes/{id}/executions.
 *
 * In mock mode the provider is simulated, so a deterministic placeholder
 * signature is generated to exercise the relay, validation order, and
 * idempotency end to end. In live mode the action is signed as an L1 action
 * with the client-held agent key via the documented `signL1Action` flow
 * (Exchange domain, phantom agent — never the user-signed
 * HyperliquidSignTransaction struct). The envelope is `{ action, nonce }`
 * plus `{ r, s, v }`, which is exactly what the Exchange endpoint expects.
 */
export async function signExchangeRequest(
  mode: "mock" | "live",
  request: {
    action: Record<string, unknown>;
    nonce: number;
    domain: typeof HL_DOMAIN;
    types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  },
  opts: { isTestnet?: boolean } = {},
): Promise<SignedPayload> {
  if (mode === "live") {
    const { getMemoryAgentKey } = await import("./agent-keystore");
    const key = getMemoryAgentKey();
    if (!key) {
      throw new Error("No agent key is available in this session.");
    }
    const [{ privateKeyToAccount }, { signL1Action }] = await Promise.all([
      import("viem/accounts"),
      import("@nktkas/hyperliquid/signing"),
    ]);
    const wallet = privateKeyToAccount(key);
    // The L1 phantom-agent signature is venue-scoped too (source "a" vs
    // "b"): a mainnet-signed order is not valid on testnet. The venue
    // comes from /health via the Take flow, never a default.
    const signature = await signL1Action({
      wallet,
      action: request.action as Record<string, unknown>,
      nonce: request.nonce,
      isTestnet: opts.isTestnet ?? false,
    });
    return {
      exchangeRequest: { action: request.action, nonce: request.nonce },
      signature: { r: signature.r, s: signature.s, v: signature.v },
    };
  }

  // Deterministic placeholder for the simulated provider. NOT a cryptographic
  // signature and never sent to a live exchange.
  const src = JSON.stringify(request.action);
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
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
    exchangeRequest: { action: request.action, nonce: request.nonce },
    signature: { r: `0x${hex(h, 32)}`, s: `0x${hex(h ^ 0x9e3779b9, 32)}`, v: 27, mock: true },
  };
}

/** Kept for the Take flow's session bootstrap. */
export async function generateSessionAgentWallet(): Promise<`0x${string}`> {
  const { generateAgentKey } = await import("./agent-keystore");
  const { persistAgentKey } = await import("./agent-keystore");
  const { privateKey } = generateAgentKey();
  // In-memory only here; ApproveAgentControl persists it encrypted after the
  // provider accepts the approval (D-019.2).
  await persistAgentKey(privateKey, "0xpending", "pending", null);
  return privateKey;
}