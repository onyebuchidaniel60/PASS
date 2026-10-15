import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";

import { forgetAgentKey } from "../lib/agent-keystore";
import {
  buildApproveAgentTypedData,
  runApproveAgent,
} from "../lib/approve-agent";
import { signatureChainIdFor, venueToHLChain } from "../lib/hyperliquid";

/**
 * Rabby chainId guard regression (branch fix/hyperliquid-agent-approval).
 *
 * Live reproduction (second session): the wallet sat on Arbitrum Sepolia
 * (walletChainId 0x66eee / 421614) while the code signed domainChainId
 * 42161, hyperliquidChain "Mainnet", wire 0xa4b1 — MetaMask refused with
 * 'Provided chainId "42161" must match the active chainId "421614"'. The
 * venue-to-chain derivation collapsed everything that was not literally
 * "testnet" (including an unreachable /health) to Mainnet. The fix:
 * venueToHLChain returns null when the venue is unknown so callers refuse
 * to sign, and runApproveAgent throws a clear Chain mismatch naming both
 * chains instead of requesting a signature the wallet must reject.
 *
 * Required behaviour:
 *  - wallet on Sepolia + venue testnet → domain 421614, "Testnet", 0x66eee;
 *  - wallet on Arbitrum One + venue mainnet → domain 42161, "Mainnet",
 *    0xa4b1;
 *  - wallet/venue mismatch → clear error naming both, never a silent
 *    Mainnet fallback;
 *  - no signing secret touches the server.
 */
const ADDR = "0x1234567890abcdef1234567890abcdef12345678" as const;
const FLAT_SIG = `0x${"22".repeat(64)}1b` as `0x${string}`;
const FIXTURE_AGENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const FIXTURE_NONCE = 1760000000000;

function setEthereum(stub: unknown) {
  (window as unknown as { ethereum?: unknown }).ethereum = stub;
}

describe("venueToHLChain (no silent Mainnet default)", () => {
  it('maps venue "testnet" to chain "Testnet"', () => {
    expect(venueToHLChain("testnet")).toBe("Testnet");
  });

  it('maps venue "mainnet" to chain "Mainnet"', () => {
    expect(venueToHLChain("mainnet")).toBe("Mainnet");
  });

  it('maps venue "mock" to chain "Mainnet" (the mock relay is label-blind)', () => {
    expect(venueToHLChain("mock")).toBe("Mainnet");
  });

  it("returns null when the venue is unknown — the caller must refuse, not guess", () => {
    // The /health-unreachable path: null, undefined and garbage must never
    // collapse to Mainnet. A null chain blocks approval with a venue error
    // instead of signing a Mainnet-labelled payload on testnet.
    expect(venueToHLChain(null)).toBeNull();
    expect(venueToHLChain(undefined)).toBeNull();
    expect(venueToHLChain("")).toBeNull();
    expect(venueToHLChain("garbage")).toBeNull();
  });

  it("venue testnet end to end: domain 421614, Testnet label, wire 0x66eee", () => {
    const chain = venueToHLChain("testnet");
    expect(chain).toBe("Testnet");
    const payload = buildApproveAgentTypedData({
      agentAddress: FIXTURE_AGENT,
      nonce: FIXTURE_NONCE,
      chain: chain ?? undefined,
    });
    expect(payload.domain.chainId).toBe(421614);
    expect(payload.message.hyperliquidChain).toBe("Testnet");
    expect(signatureChainIdFor(payload.message.hyperliquidChain)).toBe("0x66eee");
  });

  it("venue mainnet end to end: domain 42161, Mainnet label, wire 0xa4b1", () => {
    const chain = venueToHLChain("mainnet");
    expect(chain).toBe("Mainnet");
    const payload = buildApproveAgentTypedData({
      agentAddress: FIXTURE_AGENT,
      nonce: FIXTURE_NONCE,
      chain: chain ?? undefined,
    });
    expect(payload.domain.chainId).toBe(42161);
    expect(payload.message.hyperliquidChain).toBe("Mainnet");
    expect(signatureChainIdFor(payload.message.hyperliquidChain)).toBe("0xa4b1");
  });
});

describe("approveAgent domain chainIds (venue-driven, never defaulted)", () => {
  it('buildApproveAgentTypedData({ chain: "Testnet" }) returns domain.chainId === 421614', () => {
    const payload = buildApproveAgentTypedData({
      agentAddress: FIXTURE_AGENT,
      nonce: FIXTURE_NONCE,
      chain: "Testnet",
    });
    expect(payload.domain.chainId).toBe(421614);
    expect(payload.message.hyperliquidChain).toBe("Testnet");
  });

  it('buildApproveAgentTypedData({ chain: "Mainnet" }) returns domain.chainId === 42161', () => {
    const payload = buildApproveAgentTypedData({
      agentAddress: FIXTURE_AGENT,
      nonce: FIXTURE_NONCE,
      chain: "Mainnet",
    });
    expect(payload.domain.chainId).toBe(42161);
    expect(payload.message.hyperliquidChain).toBe("Mainnet");
  });

  it("the wire signatureChainId matches the venue of the domain chainId", () => {
    // The relay posts signatureChainId 0x66eee on testnet, 0xa4b1 on
    // mainnet (apps/api relay + HyperliquidExchangeClient). The EIP-712
    // domain the client signs MUST be that value parsed numerically —
    // both reference SDKs derive it this way. A mismatch recovers to a
    // garbage address on every attempt.
    for (const [chain, wireHex] of [
      ["Mainnet", "0xa4b1"],
      ["Testnet", "0x66eee"],
    ] as const) {
      const payload = buildApproveAgentTypedData({
        agentAddress: FIXTURE_AGENT,
        nonce: FIXTURE_NONCE,
        chain,
      });
      expect(payload.domain.chainId).toBe(Number.parseInt(wireHex, 16));
      expect(signatureChainIdFor(chain)).toBe(wireHex);
      expect(payload.domain.chainId).toBe(
        Number.parseInt(signatureChainIdFor(chain), 16),
      );
    }
  });

  it("a signed Testnet payload recovers to the master address", async () => {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    const payload = buildApproveAgentTypedData({
      agentAddress: FIXTURE_AGENT,
      nonce: FIXTURE_NONCE,
      chain: "Testnet",
    });
    const signature = await (
      account.signTypedData as (args: unknown) => Promise<`0x${string}`>
    )({
      domain: payload.domain,
      types: payload.types,
      primaryType: payload.primaryType,
      message: payload.message,
    });
    const recovered = await recoverTypedDataAddress({
      domain: payload.domain,
      types: payload.types,
      primaryType: payload.primaryType,
      message: payload.message,
      signature,
    } as never);
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });
});

describe("runApproveAgent prefers raw eth_signTypedData_v4 (Attempt A)", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("bypasses the wagmi wrapper via window.ethereum.request when available", async () => {
    // Wallet and venue agree (Sepolia + Testnet): the raw path signs.
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === "eth_signTypedData_v4") return FLAT_SIG;
      if (args.method === "eth_chainId") return "0x66eee";
      throw new Error(`unexpected method ${args.method}`);
    });
    setEthereum({ selectedAddress: ADDR, chainId: "0x66eee", request });
    const signTypedDataAsync = vi.fn(async () => {
      throw new Error("wagmi wrapper must not be called when raw RPC is available");
    });
    const postApprove = vi.fn(async () => ({}));

    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove,
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_signTypedData_v4" }),
    );
    // The raw params carry the venue-correct domain: 421614 on testnet.
    const rawCall = request.mock.calls.find(
      (c) => (c[0] as { method: string }).method === "eth_signTypedData_v4",
    );
    const params = (rawCall?.[0] as unknown as { params: [string, string] }).params;
    expect(params[0].toLowerCase()).toBe(ADDR.toLowerCase());
    expect(params[1]).toContain("421614");
    expect(signTypedDataAsync).not.toHaveBeenCalled();
    expect(postApprove).toHaveBeenCalledTimes(1);
  });

  it("falls back to the injected wagmi signer when no raw provider exists", async () => {
    // Legacy / test environment: no window.ethereum.request — the injected
    // signTypedDataAsync mock is the signer.
    setEthereum({ selectedAddress: ADDR });
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove: async () => ({}),
    });
    expect(signTypedDataAsync).toHaveBeenCalledTimes(1);
  });
});

describe("runApproveAgent logs the wallet chainId at signing time", () => {
  beforeEach(async () => {
    await forgetAgentKey();
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("diagnostics include the wallet chain and the domain chain together", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    setEthereum({ selectedAddress: ADDR, chainId: "0x66eee" });
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync: async () => FLAT_SIG,
      postApprove: async () => ({}),
    });
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    // The diagnosis must be grounded in what the wallet reports, not
    // assumed: wallet chain (0x66eee / 421614) next to the domain chain
    // (421614 on testnet).
    expect(logged).toMatch(/chainId/i);
    expect(logged).toContain("421614");
    expect(logged).toContain("0x66eee");
    logSpy.mockRestore();
  });

  it("names the lone provider when no multi-provider array exists", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    setEthereum({ selectedAddress: ADDR, chainId: "0x66eee" });
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync: async () => FLAT_SIG,
      postApprove: async () => ({}),
    });
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    // A single-provider wallet (MetaMask alone) has no .providers array;
    // the diagnostic must still show which provider was read.
    expect(logged).toContain("lone-provider");
    expect(logged).toContain(ADDR.toLowerCase());
    logSpy.mockRestore();
  });

  it("lists every provider when a multi-provider array exists", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const OTHER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    setEthereum({
      selectedAddress: ADDR,
      chainId: "0x66eee",
      providers: [{ selectedAddress: ADDR }, { selectedAddress: OTHER }],
    });
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync: async () => FLAT_SIG,
      postApprove: async () => ({}),
    });
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain(ADDR.toLowerCase());
    expect(logged).toContain(OTHER.toLowerCase());
    logSpy.mockRestore();
  });
});

describe("runApproveAgent wallet/venue agreement (clear error, no silent fallback)", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  function mismatchProvider(walletHex: string) {
    return vi.fn(async (args: { method: string }) => {
      if (args.method === "eth_chainId") return walletHex;
      throw new Error(`unexpected method ${args.method}`);
    });
  }

  async function runMismatched(chain: "Testnet" | "Mainnet", walletHex: string) {
    const request = mismatchProvider(walletHex);
    setEthereum({ selectedAddress: ADDR, chainId: walletHex, request });
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    const postApprove = vi.fn(async () => ({}));
    const err = (await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain,
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove,
    }).catch((e: unknown) => e)) as Error;
    expect(String(err.message)).toMatch(/Chain mismatch/);
    return { err, request, signTypedDataAsync, postApprove };
  }

  it("testnet venue + Arbitrum One wallet: names 42161 and 421614, signs nothing", async () => {
    // The live failure shape: the wallet's chain is not the venue's
    // domain. The error must name both so the operator knows which side
    // to move — never a Mainnet-labelled guess signed into the void.
    const { err, request, signTypedDataAsync, postApprove } =
      await runMismatched("Testnet", "0xa4b1");
    expect(String(err.message)).toContain("42161");
    expect(String(err.message)).toContain("421614");
    expect(String(err.message)).toMatch(/Arbitrum Sepolia/);
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_signTypedData_v4" }),
    );
    expect(signTypedDataAsync).not.toHaveBeenCalled();
    expect(postApprove).not.toHaveBeenCalled();
  });

  it("mainnet venue + Sepolia wallet: names 421614 and 42161, signs nothing", async () => {
    const { err } = await runMismatched("Mainnet", "0x66eee");
    expect(String(err.message)).toContain("421614");
    expect(String(err.message)).toContain("42161");
    expect(String(err.message)).toMatch(/Arbitrum One/);
  });

  it("matching wallet and venue signs without complaint (mainnet pair)", async () => {
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === "eth_signTypedData_v4") return FLAT_SIG;
      if (args.method === "eth_chainId") return "0xa4b1";
      throw new Error(`unexpected method ${args.method}`);
    });
    setEthereum({ selectedAddress: ADDR, chainId: "0xa4b1", request });
    const postApprove = vi.fn(async () => ({}));
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Mainnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync: async () => {
        throw new Error("raw path must win when the wallet matches");
      },
      postApprove,
    });
    expect(postApprove).toHaveBeenCalledTimes(1);
  });
});

describe("every runApproveAgent caller passes a venue-derived chain", () => {
  it("no caller omits chain or hardcodes a venue literal", () => {
    // Static guard: runApproveAgent defaults to Mainnet when chain is
    // omitted, which on testnet produces a Mainnet-labelled approval and a
    // garbage signer. Each call site must therefore pass a chain derived
    // from the venue (/health), never a literal, never nothing.
    const callers = [
      "src/components/ApproveAgentControl.tsx",
      "src/app/passes/[publicId]/take/TakeFlowClient.tsx",
    ];
    for (const rel of callers) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const blocks = src.split("runApproveAgent({");
      // blocks[0] is the code before the first call; every block after it
      // is one call site.
      expect(blocks.length).toBeGreaterThan(1);
      for (const block of blocks.slice(1)) {
        const callBody = block.slice(0, 1200);
        expect(`${rel}: runApproveAgent call must pass chain`).toContain("chain");
        expect(callBody).toMatch(/chain\s*:/);
        // A venue literal at the call site is a hardcoded default — the
        // value must flow from the venue (/health), not from a constant.
        expect(callBody).not.toMatch(/chain\s*:\s*["'](Mainnet|Testnet)["']/);
      }
    }
  });
});
