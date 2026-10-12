"use client";

import { parseSignature } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  cacheDerivationSecret,
  generateAgentKey,
  getCachedDerivationSecret,
  getMemoryAgentKey,
  messageForDerivation,
  persistAgentKey,
  restoreAgentKey,
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
 * The HyperliquidSignTransaction domain is FIXED (chainId 42161 on both
 * venues — it is Hyperliquid's own domain, not the wallet's chain). What
 * follows the venue is the message hyperliquidChain ("Mainnet"/"Testnet");
 * the server posts the matching action signatureChainId (0xa4b1/0x66eee).
 * A Mainnet-labelled approval on testnet is rejected or misfiled, so the
 * label is venue-driven, never a default.
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
  const chain = params.chain ?? "Mainnet";
  return {
    domain: HL_DOMAIN,
    types: APPROVE_AGENT_TYPES,
    primaryType: APPROVE_AGENT_PRIMARY_TYPE,
    message: {
      hyperliquidChain: chain,
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
 *  1. the derivation secret comes from the per-session memory cache when
 *     this wallet already derived it (one popup per session, D-019.2);
 *     otherwise the MASTER wallet signs the derivation message;
 *  2. the agent key is RESTORED from the encrypted store when present, so
 *     it is stable across Takes and sessions — a fresh key is generated
 *     only when nothing is stored (regenerating per Take orphaned the
 *     previously approved agent and re-prompted every time);
 *  3. when the caller already knows the venue-approved agent
 *     (`knownAgentAddress`, from /me or the preview) and it matches this
 *     client's stable agent, approval is skipped with `skipped: true` —
 *     no popup at all;
 *  4. otherwise the MASTER wallet signs the approveAgent EIP-712 payload;
 *  5. POST only { agentAddress, nonce, signature } — the key never leaves.
 *     The wallet returns a flat 0x signature; it is split into { r, s, v }
 *     before POSTing because that is the shape API_CONTRACTS.md §8 pins
 *     (a flat string fails the server's record schema with a 400);
 *  6. persist the key encrypted after the provider accepts (never before).
 *
 * Signing is injected so this is unit-testable without a wallet.
 */
/**
 * Fast-path approval check: the in-memory key skips re-approval ONLY when
 * it derives to the recorded agent address. A bare "a key exists" check
 * is wrong — after a key rotation (fresh key in memory, stale address on
 * the row) it would skip approval and sign with an agent the venue never
 * saw ("User or API Wallet … does not exist").
 */
export function isMemoryKeyApprovedFor(
  recordedAgent: string | null | undefined,
  memoryKey: `0x${string}` | null | undefined,
): boolean {
  if (!recordedAgent || !memoryKey) return false;
  try {
    return (
      privateKeyToAccount(memoryKey).address.toLowerCase() ===
      recordedAgent.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * True only when the WALLET reports the user cancelled (EIP-1193 4001 /
 * UserRejectedRequestError). Anything else — a server rejection, a network
 * failure, a malformed signature — is a REAL error and must surface
 * verbatim. Matching /rejected|cancelled/ against the message mislabels
 * "Hyperliquid rejected the agent approval" as a user cancellation, which
 * sends the operator chasing a popup they already approved.
 */
export function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number | string; message?: string };
  if (e.code === 4001 || e.code === "4001") return true;
  if (/UserRejected/i.test(e.name ?? "")) return true;
  return /user rejected/i.test(e.message ?? "");
}

export interface ApproveAgentPostBody {
  agentAddress: `0x${string}`;
  nonce: number;
  signature: { r: `0x${string}`; s: `0x${string}`; v: number };
}

export async function runApproveAgent(deps: {
  accountId: string;
  address: `0x${string}`;
  /** Venue-approved agent this client knows about (/me row or preview). */
  knownAgentAddress?: `0x${string}` | string | null;
  /**
   * Venue the approval is for. Hyperliquid requires hyperliquidChain
   * "Testnet" on testnet ("Mainnet" is rejected or misfiled there), so the
   * Take flow passes the row's venue; the Mainnet default preserves every
   * caller that has no venue context.
   */
  chain?: HLChain;
  signMessageAsync: (args: { message: string }) => Promise<string>;
  signTypedDataAsync: (args: unknown) => Promise<`0x${string}`>;
  postApprove: (
    accountId: string,
    body: ApproveAgentPostBody,
  ) => Promise<{ agentAddress?: string }>;
}): Promise<{
  agentAddress: `0x${string}`;
  persisted: boolean;
  warning?: string;
  /** True when approval was correctly skipped — no wallet popup fired. */
  skipped?: boolean;
}> {
  // D-019.2: one derivation popup per session per wallet. Memory only —
  // never localStorage/sessionStorage/IndexedDB; cleared on sign-out.
  let derivationSecret = getCachedDerivationSecret(deps.address);
  if (!derivationSecret) {
    try {
      derivationSecret = await deps.signMessageAsync({
        message: messageForDerivation(deps.address),
      });
    } catch {
      derivationSecret = null;
    }
    if (derivationSecret) cacheDerivationSecret(deps.address, derivationSecret);
  }

  // Stable key: the stored key decrypts to the same agent every session,
  // so the venue approval stays valid. A fresh key is minted only when
  // nothing is stored. Memory is untouched until the provider accepts,
  // so a rejected approval leaves no key behind.
  let freshKey: `0x${string}` | null = null;
  let agentAddress: `0x${string}`;
  if (derivationSecret && (await restoreAgentKey(derivationSecret))) {
    const mem = getMemoryAgentKey();
    if (!mem) throw new Error("Agent key restore failed.");
    agentAddress = privateKeyToAccount(mem).address;
  } else {
    const fresh = generateAgentKey();
    freshKey = fresh.privateKey;
    agentAddress = fresh.agentAddress;
  }

  // Already approved: the venue knows exactly the agent this client would
  // sign with, and its key is in memory. Skip — no popup, no POST.
  if (
    !freshKey &&
    deps.knownAgentAddress &&
    deps.knownAgentAddress.toLowerCase() === agentAddress.toLowerCase()
  ) {
    return { agentAddress, persisted: true, skipped: true };
  }

  const nonce = nowNonce();
  const typed = buildApproveAgentTypedData({ agentAddress, nonce, chain: deps.chain });

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

  const finalAddress = (res.agentAddress ?? agentAddress) as `0x${string}`;
  const keyToStore = freshKey ?? getMemoryAgentKey();
  if (!keyToStore) throw new Error("No agent key is available in this session.");
  const stored = await persistAgentKey(
    keyToStore,
    finalAddress,
    deps.address,
    derivationSecret,
  );

  return { agentAddress: finalAddress, persisted: stored.persisted, warning: stored.warning };
}
