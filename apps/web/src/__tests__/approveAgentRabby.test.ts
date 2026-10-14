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
import { signatureChainIdFor } from "../lib/hyperliquid";

/**
 * Rabby chainId guard regression (branch fix/hyperliquid-agent-approval).
 *
 * Context: Rabby sits on Arbitrum One (chain 42161). When wagmi's
 * signTypedDataAsync is asked to sign an approveAgent payload whose EIP-712
 * domain carries chainId 421614 (testnet), Rabby throws
 * "chainId should be same as current chainId". The domain is correct; the
 * wallet's chain guard (plus wagmi's wrapper-level check) is the obstacle.
 *
 * Required behaviour (task):
 *  - the master wallet signs without a chainId rejection;
 *  - the recovered signer equals the master address;
 *  - the domain chainId is 421614 on testnet, 42161 on mainnet;
 *  - the wire signatureChainId is 0x66eee / 0xa4b1 respectively;
 *  - no signing secret touches the server.
 */
const ADDR = "0x1234567890abcdef1234567890abcdef12345678" as const;
const FLAT_SIG = `0x${"22".repeat(64)}1b` as `0x${string}`;
const FIXTURE_AGENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const FIXTURE_NONCE = 1760000000000;

function setEthereum(stub: unknown) {
  (window as unknown as { ethereum?: unknown }).ethereum = stub;
}

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
    const request = vi.fn(async (args: { method: string }) => {
      if (args.method === "eth_signTypedData_v4") return FLAT_SIG;
      if (args.method === "eth_chainId") return "0xa4b1";
      throw new Error(`unexpected method ${args.method}`);
    });
    setEthereum({ selectedAddress: ADDR, chainId: "0xa4b1", request });
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
    setEthereum({ selectedAddress: ADDR, chainId: "0xa4b1" });
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync: async () => FLAT_SIG,
      postApprove: async () => ({}),
    });
    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    // The diagnosis must be grounded in what Rabby reports, not assumed:
    // wallet chain (0xa4b1 = 42161, or decimal 42161) next to the domain
    // chain (421614 on testnet).
    expect(logged).toMatch(/chainId/i);
    expect(logged).toContain("421614");
    logSpy.mockRestore();
  });
});

describe("runApproveAgent chain-switch fallback (Attempt B)", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("on a chainId rejection it switches to the venue chain, retries, and switches back", async () => {
    const seen: string[] = [];
    let signAttempts = 0;
    const request = vi.fn(async (args: { method: string; params?: unknown }) => {
      seen.push(args.method);
      if (args.method === "eth_chainId") return "0xa4b1";
      if (args.method === "wallet_switchEthereumChain") return null;
      if (args.method === "eth_signTypedData_v4") {
        signAttempts += 1;
        if (signAttempts === 1) {
          throw new Error("chainId should be same as current chainId");
        }
        return FLAT_SIG;
      }
      throw new Error(`unexpected method ${args.method}`);
    });
    setEthereum({ selectedAddress: ADDR, chainId: "0xa4b1", request });
    const signTypedDataAsync = vi.fn(async () => {
      throw new Error("wagmi wrapper must not shadow the raw retry path");
    });

    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove: async () => ({}),
    });

    // Switched to the venue chain (0x66eee = Arbitrum Sepolia) for the
    // retry, then back to the user's previous chain (0xa4b1).
    const switches = request.mock.calls.filter(
      (c) => (c[0] as { method: string }).method === "wallet_switchEthereumChain",
    );
    expect(switches.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(switches[0])).toContain("0x66eee");
    expect(JSON.stringify(switches[switches.length - 1])).toContain("0xa4b1");
    expect(signTypedDataAsync).not.toHaveBeenCalled();
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
