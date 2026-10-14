"use client";

import { arbitrum } from "viem/chains";

/**
 * Chain and EIP-712 domain for Hyperliquid L1 actions.
 *
 * Every value here is taken from the official Exchange endpoint documentation
 * (docs/INTEGRATION_VERIFICATION.md §2, §3):
 *
 *   https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
 *
 * Documented facts used:
 *  - Exchange endpoint: POST https://api.hyperliquid.xyz/exchange
 *  - signatureChainId is "the id of the chain used when signing in hexadecimal
 *    format; e.g. \"0xa4b1\" for Arbitrum"  -> 0xa4b1 === 42161
 *  - EIP-712 domain, from the documented typed-data example:
 *      name:              "HyperliquidSignTransaction"
 *      version:           "1"
 *      chainId:           42161
 *      verifyingContract: 0x0000000000000000000000000000000000000000
 *  - primaryType follows the documented pattern
 *      "HyperliquidTransaction:<ActionTypeName>"
 *
 * REASONING NOTE: the Exchange endpoint page documents the domain and the
 * primaryType naming pattern, and it defers the exact trading-action typed-data
 * struct to the official SDK ("See Python SDK for code to generate signatures
 * for these requests"). The `HyperliquidTransaction:Exchange` struct below is
 * therefore derived from the documented domain plus the documented `action`
 * field list. It must be verified against the official SDK before any live
 * mainnet submission. `approveAgent` is fully documented and implemented
 * exactly as specified.
 */

export const HYPERLIQUID_EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";
export const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

/** Arbitrum mainnet: Hyperliquid L1 signs with chain id 42161 (0xa4b1). */
export const hyperliquidChain = {
  ...arbitrum,
  id: 42161,
} as const;

export const HL_DOMAIN = {
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: 42161,
  verifyingContract: "0x0000000000000000000000000000000000000000",
} as const;

/**
 * EIP-712 domain chain id for user-signed actions (approveAgent).
 *
 * The domain is NOT fixed at 42161: both reference SDKs derive it
 * numerically from the action's own signatureChainId — the Python SDK's
 * `user_signed_payload` uses `int(action["signatureChainId"], 16)` and
 * nktkas `signUserSignedAction` uses `parseInt(action.signatureChainId)`.
 * Mainnet posts "0xa4b1" (→ 42161); testnet posts "0x66eee" (→ 421614,
 * Arbitrum Sepolia). Hyperliquid reconstructs the hash with that venue
 * domain, so a testnet approval signed under 42161 recovers to a different
 * garbage address on every attempt ("Must deposit … User: 0x…").
 *
 * `HL_DOMAIN` above stays the mainnet/default domain for the order
 * envelope; approveAgent resolves its domain through this function.
 */
export const HL_MAINNET_DOMAIN_CHAIN_ID = 42161;
export const HL_TESTNET_DOMAIN_CHAIN_ID = 421614;

export function approveAgentDomain(chain: HLChain): {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
} {
  return {
    ...HL_DOMAIN,
    chainId: chain === "Testnet" ? HL_TESTNET_DOMAIN_CHAIN_ID : HL_MAINNET_DOMAIN_CHAIN_ID,
  };
}

/** hex form of 42161, as the docs require for signatureChainId. */
export const HL_SIGNATURE_CHAIN_ID = "0xa4b1";

/** hex form of 421614 (Arbitrum Sepolia), for testnet approveAgent actions. */
export const HL_TESTNET_SIGNATURE_CHAIN_ID = "0x66eee";

/**
 * Wire signatureChainId for a venue ("0xa4b1" on mainnet, "0x66eee" on
 * testnet). This MUST satisfy
 * `Number.parseInt(signatureChainIdFor(chain), 16) ===
 * approveAgentDomain(chain).chainId` — both reference SDKs derive the
 * EIP-712 domain numerically from the action's own signatureChainId, so any
 * divergence recovers to a garbage address. Pinned by
 * `approveAgentRabby.test.ts` ("the wire signatureChainId matches the venue
 * of the domain chainId").
 */
export function signatureChainIdFor(chain: HLChain): "0xa4b1" | "0x66eee" {
  return chain === "Testnet" ? "0x66eee" : "0xa4b1";
}

/**
 * Server venue (GET /health `hyperliquidVenue`: "mainnet" | "testnet" |
 * "mock") to signing chain. Returns null when the venue is unknown —
 * unreachable /health, or a value with no signing chain — so the caller
 * refuses to sign rather than silently defaulting to Mainnet. A silent
 * Mainnet default on testnet produces a Mainnet-labelled approval and a
 * garbage signer (live MetaMask refusal: 'Provided chainId "42161" must
 * match the active chainId "421614"').
 *
 * "mock" maps to Mainnet explicitly: the mock relay is label-blind
 * (mock approvals are sent nowhere), so mock flows keep their prior label
 * instead of being blocked. Pinned by `approveAgentRabby.test.ts`.
 */
export function venueToHLChain(
  venue: string | null | undefined,
): HLChain | null {
  if (venue === "testnet") return "Testnet";
  if (venue === "mainnet" || venue === "mock") return "Mainnet";
  return null;
}

export type HLChain = "Mainnet" | "Testnet";

export function nowNonce(): number {
  return Date.now();
}

/**
 * approveAgent signing types. The EIP-712 payload itself is built by
 * `buildApproveAgentTypedData` (lib/approve-agent.ts) — there is exactly
 * one construction point, so the message can never again drift from the
 * types the way the old inline message did.
 */

export const APPROVE_AGENT_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  // The key MUST equal the primaryType verbatim. viem rejects a primary
  // type that is not a key in `types` (TypedDataInvalidPrimaryTypeError) —
  // a previous revision keyed this struct "HyperliquidTransaction" while
  // the primary type read "HyperliquidTransaction:ApproveAgent", which is
  // exactly the failure the first Take produced. Verified against the
  // official Python SDK (sign_agent) and the nktkas TS SDK
  // (ApproveAgentTypes): struct
  // "HyperliquidTransaction:ApproveAgent(string hyperliquidChain,address
  // agentAddress,string agentName,uint64 nonce)".
  "HyperliquidTransaction:ApproveAgent": [
    { name: "hyperliquidChain", type: "string" },
    { name: "agentAddress", type: "address" },
    { name: "agentName", type: "string" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

/** Primary type used when hashing an approveAgent action. */
export const APPROVE_AGENT_PRIMARY_TYPE = "HyperliquidTransaction:ApproveAgent";

/**
 * Place an order.
 *
 * Documented shape (Exchange endpoint, "Place an order"):
 *   action = { type:"order", orders:[{ a, b, p, s, r, t }], grouping, builder? }
 * where a=asset index, b=isBuy, p=price, s=size, r=reduceOnly, t=type.
 *
 * `asset` is the index in the `universe` field of the `meta` response, NOT the
 * coin name (documented under "Asset").
 */
export function buildOrderAction(params: {
  assetIndex: number;
  isBuy: boolean;
  price: string;
  size: string;
  reduceOnly?: boolean;
  tif?: "Alo" | "Ioc" | "Gtc";
  grouping?: "na" | "normalTpsl" | "positionTpsl";
  /**
   * The Pass's own exit levels. Present or absent independently — a Pass with
   * only a stop loss must not gain an invented take profit.
   */
  takeProfit?: string | null;
  stopLoss?: string | null;
}) {
  const orders: Array<Record<string, unknown>> = [
    {
      a: params.assetIndex,
      b: params.isBuy,
      p: params.price,
      s: params.size,
      r: params.reduceOnly ?? false,
      t: { limit: { tif: params.tif ?? "Gtc" } },
    },
  ];

  /**
   * Bracket exits.
   *
   * WHY THIS EXISTS: a Pass advertises entry, take profit and stop loss, but
   * until this the action carried ONLY the entry. A Taker who took such a Pass
   * would have held an UNPROTECTED position with no exit order anywhere at the
   * venue — see docs/EXECUTION_READINESS.md.
   *
   * Shape verified against the official Exchange endpoint documentation:
   *   t: { trigger: { isMarket, triggerPx, tpsl: "tp" | "sl" } }
   *   grouping: "normalTpsl"
   *
   * Three rules that are load-bearing and easy to get backwards:
   *
   *  - The exits are on the OPPOSITE side to the entry. An exit that matched
   *    the entry side would ADD to the position instead of closing it. So
   *    `isBuy` is inverted here, once, and nowhere else.
   *  - `r: true` on both exits. Reduce-only is what makes them incapable of
   *    reversing the position if the stop is hit before the fill.
   *  - `isMarket: true`, so a triggered exit does not rest unfilled on a book
   *    that has already gapped through the level. A stop that does not fill is
   *    not a stop.
   */
  const exitSide = !params.isBuy;
  const hasExits = Boolean(params.takeProfit || params.stopLoss);

  if (params.takeProfit) {
    orders.push({
      a: params.assetIndex,
      b: exitSide,
      // The resting price is irrelevant for a market trigger, but the field is
      // required. The trigger price is what the exchange acts on.
      p: params.takeProfit,
      s: params.size,
      r: true,
      t: { trigger: { isMarket: true, triggerPx: params.takeProfit, tpsl: "tp" } },
    });
  }

  if (params.stopLoss) {
    orders.push({
      a: params.assetIndex,
      b: exitSide,
      p: params.stopLoss,
      s: params.size,
      r: true,
      t: { trigger: { isMarket: true, triggerPx: params.stopLoss, tpsl: "sl" } },
    });
  }

  return {
    type: "order" as const,
    orders,
    // `normalTpsl` is the documented grouping that tells the exchange these
    // orders are one bracket. It is only meaningful when exits exist, so a
    // bare entry keeps "na".
    grouping: hasExits
      ? ((params.grouping ?? "normalTpsl") as "na" | "normalTpsl" | "positionTpsl")
      : "na",
  };
}