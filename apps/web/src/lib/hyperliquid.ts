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

/** hex form of 42161, as the docs require for signatureChainId. */
export const HL_SIGNATURE_CHAIN_ID = "0xa4b1";

export type HLChain = "Mainnet" | "Testnet";

export function nowNonce(): number {
  return Date.now();
}

/**
 * approveAgent action. Field names and semantics are exactly as documented.
 * The inner nonce must match the outer request nonce.
 */
export function buildApproveAgentAction(params: {
  agentAddress: `0x${string}`;
  nonce: number;
  chain?: HLChain;
  agentName?: string;
}) {
  return {
    type: "approveAgent" as const,
    hyperliquidChain: params.chain ?? ("Mainnet" as const),
    signatureChainId: HL_SIGNATURE_CHAIN_ID,
    agentAddress: params.agentAddress,
    nonce: params.nonce,
    ...(params.agentName ? { agentName: params.agentName } : {}),
  };
}

export const APPROVE_AGENT_TYPES = {
  HyperliquidTransaction: [
    { name: "hyperliquidChain", type: "string" },
    { name: "signatureChainId", type: "string" },
    { name: "agentAddress", type: "address" },
    { name: "nonce", type: "uint64" },
    { name: "isMainnet", type: "bool" },
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
}) {
  return {
    type: "order" as const,
    orders: [
      {
        a: params.assetIndex,
        b: params.isBuy,
        p: params.price,
        s: params.size,
        r: params.reduceOnly ?? false,
        t: { limit: { tif: params.tif ?? "Gtc" } },
      },
    ],
    grouping: params.grouping ?? "na",
  };
}