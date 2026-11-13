"use client";

import { parseSignature } from "viem";
import {
  forgetAgentKey,
  generateAgentKey,
} from "./agent-keystore";
import { buildApproveAgentTypedData } from "./approve-agent";
import { nowNonce, type HLChain } from "./hyperliquid";

/**
 * Hyperliquid agent-key revocation.
 *
 * Hyperliquid has no standalone revoke action: approving a new unnamed agent
 * deregisters the previous unnamed agent. This helper:
 *   1. mints a throwaway address (no key is kept for it),
 *   2. has the MASTER wallet sign an `approveAgent` payload for that address,
 *   3. posts it to PASS's revoke route, which relays it and clears its cache,
 *   4. forgets the local agent key.
 *
 * The replacement address never signs an order and is not stored by PASS.
 */

interface Eip1193Provider {
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
}

function readInjectedProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

function isMethodNotSupportedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number | string; message?: string };
  if (e.code === -32601 || e.code === -32602 || e.code === 4200) return true;
  return /method .*not (found|supported|implemented)|not support.*method|unknown method/i.test(
    e.message ?? "",
  );
}

async function signRaw(
  provider: Eip1193Provider,
  address: `0x${string}`,
  typed: ReturnType<typeof buildApproveAgentTypedData>,
): Promise<`0x${string}`> {
  const jsonCompatible = JSON.parse(
    JSON.stringify(typed, (_key, value: unknown) =>
      typeof value === "bigint" ? Number(value) : value,
    ),
  );
  const res = await provider.request!({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(jsonCompatible)],
  });
  if (typeof res !== "string" || !res.startsWith("0x")) {
    throw new Error("Wallet returned an unusable revocation signature.");
  }
  return res as `0x${string}`;
}

export interface RevokeAgentPostBody {
  agentAddress: `0x${string}`;
  nonce: number;
  signature: { r: `0x${string}`; s: `0x${string}`; v: number };
  revokedAgentAddress: string;
}

export async function runRevokeAgent(deps: {
  masterAddress: `0x${string}`;
  revokedAgentAddress: string;
  chain: HLChain;
  signTypedDataAsync: (args: unknown) => Promise<`0x${string}`>;
  postRevoke: (
    masterAddress: string,
    body: RevokeAgentPostBody,
  ) => Promise<{ ok: boolean }>;
}): Promise<void> {
  const throwaway = generateAgentKey();
  const nonce = nowNonce();
  const typed = buildApproveAgentTypedData({
    agentAddress: throwaway.agentAddress,
    nonce,
    chain: deps.chain,
  });

  let signature: `0x${string}`;
  const injected = readInjectedProvider();
  if (typeof injected?.request === "function") {
    try {
      signature = await signRaw(injected, deps.masterAddress, typed);
    } catch (err) {
      if (!isMethodNotSupportedError(err)) throw err;
      signature = await deps.signTypedDataAsync({
        ...typed,
        account: deps.masterAddress,
      } as never);
    }
  } else {
    signature = await deps.signTypedDataAsync({
      ...typed,
      account: deps.masterAddress,
    } as never);
  }

  const { r, s, v } = parseSignature(signature);
  await deps.postRevoke(deps.masterAddress, {
    agentAddress: throwaway.agentAddress,
    nonce,
    signature: { r, s, v: Number(v) },
    revokedAgentAddress: deps.revokedAgentAddress,
  });

  // The old key must not be able to sign again in this browser session.
  await forgetAgentKey();
}
