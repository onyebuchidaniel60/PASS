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
  approveAgentDomain,
  nowNonce,
  signatureChainIdFor,
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
 * The HyperliquidSignTransaction domain follows the venue's
 * signatureChainId numerically (42161 on mainnet, 421614 on testnet —
 * `approveAgentDomain`), exactly as both reference SDKs derive it. What
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
  domain: ReturnType<typeof approveAgentDomain>;
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
    domain: approveAgentDomain(chain),
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

/** True when the provider does not implement the raw signing method. */
function isMethodNotSupportedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number | string; message?: string };
  if (e.code === -32601 || e.code === -32602 || e.code === 4200) return true;
  return /method .*not (found|supported|implemented)|not support.*method|unknown method/i.test(
    e.message ?? "",
  );
}

interface Eip1193Provider {
  selectedAddress?: string;
  chainId?: string | number | null;
  networkVersion?: string | null;
  request?: (args: {
    method: string;
    params?: unknown;
  }) => Promise<unknown>;
  providers?: Array<{
    selectedAddress?: string;
    _state?: { accounts?: string[] };
  }>;
}

function readInjectedProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

/** Synchronous wallet-chain read (hex preferred, decimal tolerated). */
function readWalletChainSync(
  injected: Eip1193Provider | undefined,
): string | null {
  const raw = injected?.chainId ?? injected?.networkVersion ?? null;
  if (raw === null || raw === undefined) return null;
  return String(raw);
}

function chainIdToDecimal(value: string | null): number | null {
  if (!value) return null;
  const s = value.trim().toLowerCase();
  const n = s.startsWith("0x")
    ? Number.parseInt(s, 16)
    : Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** Best-effort live wallet chain via eth_chainId; null when unavailable. */
async function readWalletChainLive(
  injected: Eip1193Provider | undefined,
): Promise<string | null> {
  if (typeof injected?.request !== "function") return null;
  try {
    const res = await injected.request({ method: "eth_chainId" });
    return typeof res === "string" ? res : null;
  } catch {
    return null;
  }
}

/**
 * Attempt A — raw eth_signTypedData_v4.
 *
 * Calls window.ethereum.request directly instead of the wagmi
 * signTypedDataAsync wrapper, bypassing any wrapper-level chainId guard.
 * Rabby shows the typed-data domain to the user and signs it.
 */
async function requestRawApproveAgentSignature(
  injected: Eip1193Provider,
  address: `0x${string}`,
  typed: ReturnType<typeof buildApproveAgentTypedData>,
): Promise<`0x${string}`> {
  // JSON cannot serialise bigint: the nonce fits in a double (Date.now()),
  // so it travels as a number. The domain chainId stays numeric.
  const jsonCompatible = JSON.parse(
    JSON.stringify(typed, (_key, value: unknown) =>
      typeof value === "bigint" ? Number(value) : value,
    ),
  );
  const res = await injected.request!({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(jsonCompatible)],
  });
  if (typeof res !== "string" || !res.startsWith("0x")) {
    throw new Error(
      "Wallet returned an unusable approveAgent signature.",
    );
  }
  return res as `0x${string}`;
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
  signMessageAsync: (args: {
    message: string;
    account?: `0x${string}`;
  }) => Promise<string>;
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
  // `account` is pinned on BOTH signatures so the wallet can never sign
  // with a non-selected account (D-019.1: the MASTER signs approveAgent).
  let derivationSecret = getCachedDerivationSecret(deps.address);
  if (!derivationSecret) {
    try {
      derivationSecret = await deps.signMessageAsync({
        message: messageForDerivation(deps.address),
        account: deps.address,
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

  // Temporary diagnostics (single Take, then removed): what address the code
  // thinks it is signing with, what the injected wallet exposes as selected,
  // whether multiple providers are present and which one wins, what agent
  // address the typed data actually carries, AND the wallet's chain at the
  // moment of signing next to the domain chain the wallet is asked to sign.
  // The Rabby failure ("chainId should be same as current chainId") can only
  // be diagnosed from what Rabby reports — injected.chainId / eth_chainId —
  // never from what the code assumes.
  // `window` is guarded for SSR/test runtimes; in a real browser it exists.
  const injected = readInjectedProvider();
  const walletChainSync = readWalletChainSync(injected);
  const walletChainLive = await readWalletChainLive(injected);
  const walletChainHex = walletChainLive ?? walletChainSync;
  // Multi-provider wallets expose .providers; a lone wallet (MetaMask
  // alone) does not, so the diagnostic names the lone provider instead of
  // logging `providers= undefined` and leaving the check dead.
  const providerAddrs = injected?.providers?.map(
    (p) => p.selectedAddress || p._state?.accounts?.[0],
  );
  console.log("[approveAgent]",
    "deps.address=", deps.address,
    "rabby=", injected?.selectedAddress,
    "providers=", providerAddrs ?? [`lone-provider:${injected?.selectedAddress ?? "none"}`],
    "typed.agentAddress=", typed.message.agentAddress,
    "walletChainId=", walletChainHex,
    "walletChainIdDec=", chainIdToDecimal(walletChainHex),
    "domainChainId=", typed.domain.chainId,
    "domainChainIdHex=", `0x${typed.domain.chainId.toString(16)}`,
    "hyperliquidChain=", typed.message.hyperliquidChain,
    "wireSignatureChainId=", signatureChainIdFor(typed.message.hyperliquidChain));

  // The signer must be the wagmi-connected master wallet. If wagmi is bound
  // to a different provider than the one the injected wallet exposes, throw
  // here and name the mismatch instead of silently signing with the wrong
  // key. This error must surface verbatim — do not catch and generalize it.
  const connected = deps.address?.toLowerCase();
  const selected = injected?.selectedAddress?.toLowerCase();
  if (!connected || !selected || connected !== selected) {
    throw new Error(
      `Signer mismatch: wagmi has ${connected}, injected wallet has ${selected}`
    );
  }

  // Wallet/venue agreement, checked BEFORE any signature is requested. When
  // the wallet sits on a different chain than the venue's domain (the live
  // failure: wallet 0x66eee/Sepolia, approval Mainnet-labelled 42161),
  // requesting the signature can only produce the wallet's chainId refusal.
  // Throw a clear error naming both sides instead — never a silent fallback,
  // and never a programmatic network switch of the user's wallet.
  const walletDec = chainIdToDecimal(walletChainHex);
  if (walletDec !== null && walletDec !== typed.domain.chainId) {
    const want = typed.message.hyperliquidChain;
    throw new Error(
      `Chain mismatch: wallet is on chain ${walletDec} (${walletChainHex}) ` +
      `but venue "${want}" requires domain ${typed.domain.chainId} ` +
      `(${signatureChainIdFor(typed.message.hyperliquidChain)}). ` +
      `Switch your wallet to ${want === "Testnet" ? "Arbitrum Sepolia" : "Arbitrum One"} and try again. ` +
      `No signature was requested.`,
    );
  }

  // Signing path (fix/hyperliquid-agent-approval):
  //  - Raw eth_signTypedData_v4 via window.ethereum.request, bypassing any
  //    wrapper-level chainId guard in wagmi/viem. The wallet shows the
  //    typed-data domain to the user and signs it.
  //  - Fallback: no raw provider (SSR/tests/legacy wallets) or a provider
  //    that does not implement the method — the injected wagmi signer.
  // A user cancellation (EIP-1193 4001) propagates verbatim on every path.
  let signature: `0x${string}`;
  let signPath: "raw" | "wagmi";
  if (typeof injected?.request === "function") {
    try {
      signature = await requestRawApproveAgentSignature(
        injected,
        deps.address,
        typed,
      );
      signPath = "raw";
    } catch (rawErr) {
      if (isMethodNotSupportedError(rawErr)) {
        signature = await deps.signTypedDataAsync({
          ...typed,
          account: deps.address,
        } as never);
        signPath = "wagmi";
      } else {
        throw rawErr;
      }
    }
  } else {
    // wagmi's typed-data generics are narrowed to standard EIP-712 primary
    // types; Hyperliquid's is documented as
    // "HyperliquidTransaction:<ActionTypeName>", so the payload is passed
    // through structurally. `account` pins the signer to the wagmi-connected
    // master wallet — without it the call can resolve to a stale or
    // non-selected account and the venue rejects an unknown signer.
    signature = await deps.signTypedDataAsync({
      ...typed,
      account: deps.address,
    } as never);
    signPath = "wagmi";
  }
  console.log("[approveAgent]",
    "signPath=", signPath,
    "domainChainId=", typed.domain.chainId,
    "hyperliquidChain=", typed.message.hyperliquidChain);

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
