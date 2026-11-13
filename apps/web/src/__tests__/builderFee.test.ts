import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APPROVE_BUILDER_FEE_PRIMARY_TYPE,
  buildApproveBuilderFeeTypedData,
  isBuilderFeeApproved,
  maxBuilderFee,
  runApproveBuilderFee,
} from "../lib/builder-fee";

const BUILDER = "0x1234567890abcdef1234567890abcdef12345678" as const;
const MASTER = "0x9999999999999999999999999999999999999999" as const;
const FLAT_SIG = `0x${"22".repeat(64)}1b` as `0x${string}`;
const INFO = "https://api.hyperliquid.xyz/info";

afterEach(() => {
  delete (window as unknown as { ethereum?: unknown }).ethereum;
  vi.unstubAllGlobals();
});

describe("approveBuilderFee typed data", () => {
  it("builds the venue type with the max rate and builder", () => {
    const typed = buildApproveBuilderFeeTypedData({
      builder: BUILDER,
      maxFeeRate: "0.05%",
      nonce: 1760000000000,
      chain: "Mainnet",
    });
    expect(typed.primaryType).toBe(APPROVE_BUILDER_FEE_PRIMARY_TYPE);
    expect(typed.types[APPROVE_BUILDER_FEE_PRIMARY_TYPE]).toEqual([
      { name: "hyperliquidChain", type: "string" },
      { name: "maxFeeRate", type: "string" },
      { name: "builder", type: "address" },
      { name: "nonce", type: "uint64" },
    ]);
    expect(typed.domain.chainId).toBe(42161);
    expect(typed.message).toMatchObject({
      hyperliquidChain: "Mainnet",
      maxFeeRate: "0.05%",
      builder: BUILDER,
    });
  });

  it("uses the Arbitrum Sepolia domain on testnet", () => {
    const typed = buildApproveBuilderFeeTypedData({
      builder: BUILDER,
      maxFeeRate: "0.05%",
      nonce: 1,
      chain: "Testnet",
    });
    expect(typed.domain.chainId).toBe(421614);
    expect(typed.message.hyperliquidChain).toBe("Testnet");
  });
});

describe("maxBuilderFee", () => {
  it("posts the Info API request and reads tenths of a basis point", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => 50,
    })) as unknown as typeof fetch;
    const max = await maxBuilderFee({
      infoUrl: INFO,
      user: MASTER,
      builder: BUILDER,
      fetchImpl,
    });
    expect(max).toBe(50);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as unknown as [string, { body?: string }];
    expect(url).toBe(INFO);
    expect(JSON.parse(init.body ?? "{}")).toEqual({
      type: "maxBuilderFee",
      user: MASTER,
      builder: BUILDER,
    });
  });

  it("requires the approval to meet the configured fee", async () => {
    const atThreshold = vi.fn(async () => ({
      ok: true,
      json: async () => 50,
    })) as unknown as typeof fetch;
    const below = vi.fn(async () => ({
      ok: true,
      json: async () => 49,
    })) as unknown as typeof fetch;

    await expect(
      isBuilderFeeApproved({
        infoUrl: INFO,
        user: MASTER,
        builder: BUILDER,
        fetchImpl: atThreshold,
        requiredTenthsBps: 50,
      }),
    ).resolves.toBe(true);
    await expect(
      isBuilderFeeApproved({
        infoUrl: INFO,
        user: MASTER,
        builder: BUILDER,
        fetchImpl: below,
        requiredTenthsBps: 50,
      }),
    ).resolves.toBe(false);
  });

  it("returns false rather than throwing when the Info API fails", async () => {
    const down = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(
      isBuilderFeeApproved({
        infoUrl: INFO,
        user: MASTER,
        builder: BUILDER,
        fetchImpl: down,
      }),
    ).resolves.toBe(false);
  });
});

describe("runApproveBuilderFee", () => {
  it("signs with the master wallet and posts only nonce/signature", async () => {
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    const postApprove = vi.fn(async () => ({ ok: true }));

    await runApproveBuilderFee({
      masterAddress: MASTER,
      builder: BUILDER,
      maxFeeRate: "0.05%",
      chain: "Mainnet",
      signTypedDataAsync,
      postApprove,
    });

    expect(signTypedDataAsync).toHaveBeenCalledTimes(1);
    const typed = (
      signTypedDataAsync.mock.calls[0] as unknown as [
        {
          domain: { chainId: number };
          message: Record<string, unknown>;
          primaryType: string;
        },
      ]
    )[0];
    expect(typed.domain.chainId).toBe(42161);
    expect(typed.primaryType).toBe(APPROVE_BUILDER_FEE_PRIMARY_TYPE);
    expect(typed.message).toMatchObject({
      hyperliquidChain: "Mainnet",
      maxFeeRate: "0.05%",
      builder: BUILDER,
    });

    expect(postApprove).toHaveBeenCalledTimes(1);
    const [address, body] = postApprove.mock.calls[0] as unknown as [
      string,
      { nonce: number; signature: { r: string; s: string; v: number } },
    ];
    expect(address).toBe(MASTER);
    expect(body.signature).toEqual({
      r: `0x${"22".repeat(32)}`,
      s: `0x${"22".repeat(32)}`,
      v: 27,
    });
    expect(typeof body.nonce).toBe("number");
  });
});
