"use client";

import { parseSignature } from "viem";
import { BUILDER_FEE_TENTHS_BPS } from "@pass/domain/fees";
import {
  approveAgentDomain,
  nowNonce,
  type HLChain,
} from "./hyperliquid";

/**
 * Hyperliquid builder-fee approval.
 *
 * The venue requires a master-signed `approveBuilderFee` action before an
 * order carrying `builder` is accepted. The Info API `maxBuilderFee` read is
 * the source of truth for the existing approval, so a stale local flag can
 * never skip the prompt incorrectly.
 */

export const APPROVE_BUILDER_FEE_PRIMARY_TYPE =
  "HyperliquidTransaction:ApproveBuilderFee";

export const APPROVE_BUILDER_FEE_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  "HyperliquidTransaction:ApproveBuilderFee": [
    { name: "hyperliquidChain", type: "string" },
    { name: "maxFeeRate", type: "string" },
    { name: "builder", type: "address" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

export function buildApproveBuilderFeeTypedData(params: {
  builder: `0x${string}`;
  maxFeeRate: string;
  nonce: number;
  chain?: HLChain;
}) {
  const chain = params.chain ?? "Mainnet";
  return {
    domain: approveAgentDomain(chain),
    types: APPROVE_BUILDER_FEE_TYPES,
    primaryType: APPROVE_BUILDER_FEE_PRIMARY_TYPE,
    message: {
      hyperliquidChain: chain,
      maxFeeRate: params.maxFeeRate,
      builder: params.builder,
      nonce: BigInt(params.nonce),
    },
  };
}

export async function maxBuilderFee(params: {
  infoUrl: string;
  user: string;
  builder: string;
  fetchImpl?: typeof fetch;
}): Promise<number | null> {
  if (!params.infoUrl) throw new Error("The Hyperliquid Info API URL is not configured.");
  const res = await (params.fetchImpl ?? fetch)(params.infoUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "maxBuilderFee",
      user: params.user,
      builder: params.builder,
    }),
  });
  if (!res.ok) {
    throw new Error(`Hyperliquid Info API answered ${res.status} for maxBuilderFee.`);
  }
  const body = (await res.json()) as unknown;
  return typeof body === "number" && Number.isFinite(body) ? body : null;
}

/**
 * True only when the venue reports an approval at least as large as PASS's
 * fee. Any failure returns false so the caller prompts instead of signing an
 * order the venue will reject.
 */
export async function isBuilderFeeApproved(params: {
  infoUrl: string;
  user: string;
  builder: string;
  fetchImpl?: typeof fetch;
  requiredTenthsBps?: number;
}): Promise<boolean> {
  try {
    const max = await maxBuilderFee(params);
    return max !== null && max >= (params.requiredTenthsBps ?? BUILDER_FEE_TENTHS_BPS);
  } catch {
    return false;
  }
}

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
  typed: ReturnType<typeof buildApproveBuilderFeeTypedData>,
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
    throw new Error("Wallet returned an unusable builder fee signature.");
  }
  return res as `0x${string}`;
}

export interface ApproveBuilderFeePostBody {
  nonce: number;
  signature: { r: `0x${string}`; s: `0x${string}`; v: number };
}

export async function runApproveBuilderFee(deps: {
  masterAddress: `0x${string}`;
  builder: `0x${string}`;
  maxFeeRate: string;
  chain: HLChain;
  signTypedDataAsync: (args: unknown) => Promise<`0x${string}`>;
  postApprove: (
    masterAddress: string,
    body: ApproveBuilderFeePostBody,
  ) => Promise<{ ok: boolean }>;
}): Promise<void> {
  const nonce = nowNonce();
  const typed = buildApproveBuilderFeeTypedData({
    builder: deps.builder,
    maxFeeRate: deps.maxFeeRate,
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
  await deps.postApprove(deps.masterAddress, {
    nonce,
    signature: { r, s, v: Number(v) },
  });
}
