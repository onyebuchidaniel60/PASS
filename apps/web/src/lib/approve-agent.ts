"use client";

import { parseSignature } from "viem";
import {
  generateAgentKey,
  messageForDerivation,
  persistAgentKey,
} from "./agent-keystore";
import {
  APPROVE_AGENT_PRIMARY_TYPE,
  APPROVE_AGENT_TYPES,
  HL_DOMAIN,
  nowNonce,
  type HLChain,
} from "./hyperliquid";

/**
 * The exact EIP-712 payload the master wallet signs for agent approval.
 *
 * Shape verified against the official Python SDK (`sign_agent`) and the
 * nktkas TS SDK (`ApproveAgentTypes`): the types object carries the
 * primary type's own entry plus EIP712Domain, and the message carries
 * exactly those four fields with `agentName: ""` for an unnamed agent
 * (the SDK signs `agentName: name or ""`; an absent name is the empty
 * string on the wire, never a missing field).
 *
 * Domain chainId is 42161 deliberately, NOT the 0x66eee the Python SDK
 * hardcodes: Hyperliquid derives the verification domain from the
 * `signatureChainId` our own server posts alongside the signature
 * (`relayApproveAgent` posts 0xa4b1), so the signed domain must match
 * OUR posted action. Self-consistency between signed message and posted
 * action is the invariant; either value verifies iff both sides agree.
 */
export function buildApproveAgentTypedData(params: {
  agentAddress: `0x${string}`;
  nonce: number;
  chain?: HLChain;
}): {
  domain: typeof HL_DOMAIN;
  types: typeof APPROVE_AGENT_TYPES;
  primaryType: typeof APPROVE_AGENT_PRIMARY_TYPE;
  message: {
    hyperliquidChain: HLChain;
    agentAddress: `0x${string}`;
    agentName: string;
    nonce: bigint;
  };
} {
  return {
    domain: HL_DOMAIN,
    types: APPROVE_AGENT_TYPES,
    primaryType: APPROVE_AGENT_PRIMARY_TYPE,
    message: {
      hyperliquidChain: params.chain ?? "Mainnet",
      agentAddress: params.agentAddress,
      agentName: "",
      nonce: BigInt(params.nonce),
    },
  };
}

/**
 * First-execution agent approval (docs/DECISIONS.md D-019.1), as a callable.
 *
 * The same steps `ApproveAgentControl` performs, extracted so the Take flow
 * can run them inline before signing its first order:
 *  1. generate a fresh agent key in the browser (viem generatePrivateKey);
 *  2. derive the storage secret from a master-wallet message signature
 *     (non-fatal — without it the key stays in memory only, D-019.2);
 *  3. the MASTER wallet signs the approveAgent EIP-712 payload;
 *  4. POST only { agentAddress, nonce, signature } — the key never leaves.
 *     The wallet returns a flat 0x signature; it is split into { r, s, v }
 *     before POSTing because that is the shape API_CONTRACTS.md §8 pins
 *     (a flat string fails the server's record schema with a 400);
 *  5. persist the key encrypted after the provider accepts (never before).
 *
 * Signing is injected so this is unit-testable without a wallet.
 */
export interface ApproveAgentPostBody {
  agentAddress: `0x${string}`;
  nonce: number;
  signature: { r: `0x${string}`; s: `0x${string}`; v: number };
}

export async function runApproveAgent(deps: {
  accountId: string;
  address: `0x${string}`;
  signMessageAsync: (args: { message: string }) => Promise<string>;
  signTypedDataAsync: (args: unknown) => Promise<`0x${string}`>;
  postApprove: (
    accountId: string,
    body: ApproveAgentPostBody,
  ) => Promise<{ agentAddress?: string }>;
}): Promise<{ agentAddress: `0x${string}`; persisted: boolean; warning?: string }> {
  const { privateKey, agentAddress } = generateAgentKey();

  let derivationSecret: string | null = null;
  try {
    derivationSecret = await deps.signMessageAsync({
      message: messageForDerivation(deps.address),
    });
  } catch {
    derivationSecret = null;
  }

  const nonce = nowNonce();
  const typed = buildApproveAgentTypedData({ agentAddress, nonce });

  // wagmi's typed-data generics are narrowed to standard EIP-712 primary
  // types; Hyperliquid's is documented as
  // "HyperliquidTransaction:<ActionTypeName>", so the payload is passed
  // through structurally.
  const signature = await deps.signTypedDataAsync(typed as never);

  // viem returns a flat 0x signature; the §8 body carries { r, s, v }.
  const { r, s, v } = parseSignature(signature);
  const res = await deps.postApprove(deps.accountId, {
    agentAddress,
    nonce,
    signature: { r, s, v: Number(v) },
  });

  const stored = await persistAgentKey(
    privateKey,
    (res.agentAddress ?? agentAddress) as `0x${string}`,
    deps.address,
    derivationSecret,
  );

  return { agentAddress, persisted: stored.persisted, warning: stored.warning };
}
