import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem";
import { signUserSignedAction } from "@nktkas/hyperliquid/signing";
import { ApproveAgentTypes } from "@nktkas/hyperliquid/api/exchange";

import { forgetAgentKey, hasAgentKeyInMemory } from "../lib/agent-keystore";
import { clearSessionKeys } from "../lib/agent-keystore";
import {
  buildApproveAgentTypedData,
  isMemoryKeyApprovedFor,
  isUserRejection,
  runApproveAgent,
} from "../lib/approve-agent";

/**
 * First-execution approval with injected signing: no wallet, no network.
 * The key never appears in the posted body — only its address does.
 */
const ADDR = "0x1234567890abcdef1234567890abcdef12345678" as const;
/** A different injected account, for the signer-mismatch guard. */
const OTHER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
/** A well-formed flat 65-byte wallet signature (r, s, v=27). */
const FLAT_SIG = `0x${"22".repeat(64)}1b` as `0x${string}`;
const SPLIT_SIG = {
  r: `0x${"22".repeat(32)}`,
  s: `0x${"22".repeat(32)}`,
  v: 27,
};

describe("runApproveAgent", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    // The guard compares the wagmi address against the injected wallet's
    // selected address: every non-guard test runs as the matched signer.
    (window as unknown as { ethereum?: unknown }).ethereum = {
      selectedAddress: ADDR,
    };
    // The temporary [approveAgent] diagnostic log stays out of test output.
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("posts only address/nonce/signature and holds the key in memory", async () => {
    const postApprove = vi.fn(async () => ({ agentAddress: undefined }));
    const signMessageAsync = vi.fn(async () => "0xderivationsecret");
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);

    const done = await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      signMessageAsync,
      signTypedDataAsync,
      postApprove,
    });

    // Master signed twice: once for the storage derivation, once typed.
    expect(signMessageAsync).toHaveBeenCalledTimes(1);
    expect(signTypedDataAsync).toHaveBeenCalledTimes(1);
    const typedCall = signTypedDataAsync.mock.calls[0] as unknown as
      | [{ primaryType: string; message: Record<string, unknown> }]
      | undefined;
    const typed = typedCall?.[0];
    expect(typed?.primaryType).toBe("HyperliquidTransaction:ApproveAgent");
    // viem rejects a primaryType that is not a key in `types`
    // (TypedDataInvalidPrimaryTypeError — the exact operator failure).
    // The types object must carry the primary type's own entry.
    const keyed = typed as unknown as {
      primaryType: string;
      types: Record<string, unknown>;
    };
    expect(keyed.types[keyed.primaryType]).toBeDefined();
    expect(typeof typed?.message.nonce).toBe("bigint");

    // Only the address and the signature leave the client.
    expect(postApprove).toHaveBeenCalledTimes(1);
    const postCall = postApprove.mock.calls[0] as unknown as
      | [string, Record<string, unknown>]
      | undefined;
    const [id, body] = postCall ?? ["", {}];
    expect(id).toBe("acct-1");
    expect(body.agentAddress).toBe(done.agentAddress);
    // API_CONTRACTS §8 pins { r, s, v } — a flat string fails the server's
    // record schema with a 400 (the exact operator failure). The wallet's
    // flat output is split before POSTing.
    expect(body.signature).toEqual(SPLIT_SIG);
    expect(typeof body.nonce).toBe("number");
    expect(JSON.stringify(body)).not.toContain("0xderivationsecret");
    expect(hasAgentKeyInMemory()).toBe(true);
    expect(done.persisted).toBe(false);
    expect(done.warning).toMatch(/memory only/);
  });

  it("proceeds in-memory when the derivation signature is refused", async () => {
    const postApprove = vi.fn(async () => ({}));
    const signMessageAsync = vi.fn(async () => {
      throw new Error("rejected");
    });
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);

    const done = await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      signMessageAsync,
      signTypedDataAsync,
      postApprove,
    });

    expect(postApprove).toHaveBeenCalledTimes(1);
    expect(hasAgentKeyInMemory()).toBe(true);
    expect(done.warning).toMatch(/memory only/);
  });

  it("does not persist when the provider rejects", async () => {
    await forgetAgentKey();
    const postApprove = vi.fn(async () => {
      throw new Error("SIGNATURE_REJECTED");
    });

    await expect(
      runApproveAgent({
        accountId: "acct-1",
        address: ADDR,
        signMessageAsync: async () => "0xderivationsecret",
        signTypedDataAsync: async () => FLAT_SIG,
        postApprove,
      }),
    ).rejects.toThrow("SIGNATURE_REJECTED");
    // persistAgentKey never ran, so no generated key lingers in memory.
    expect(hasAgentKeyInMemory()).toBe(false);
  });
});

/**
 * Popup table (D-019.1/D-019.2): derivation signs once per session, the
 * agent key is stable, and an already-approved agent is skipped with zero
 * wallet interaction. Sign-out clears the session keys, so derivation
 * prompts again afterwards.
 */
describe("runApproveAgent session behaviour (popup table)", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    (window as unknown as { ethereum?: unknown }).ethereum = {
      selectedAddress: ADDR,
    };
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  const deps = () => ({
    accountId: "acct-1",
    address: ADDR,
    signMessageAsync: vi.fn(async () => "0xderivationsecret"),
    signTypedDataAsync: vi.fn(async () => FLAT_SIG),
    postApprove: vi.fn(async () => ({})),
  });

  it("second Take in the same session fires zero wallet popups", async () => {
    const d = deps();
    const first = await runApproveAgent(d);
    expect(d.signMessageAsync).toHaveBeenCalledTimes(1);
    expect(d.signTypedDataAsync).toHaveBeenCalledTimes(1);
    expect(d.postApprove).toHaveBeenCalledTimes(1);
    expect(first.skipped).toBeUndefined();

    // Same session, venue already knows this exact agent: derivation comes
    // from the session cache and approval is skipped — no popup at all.
    const second = await runApproveAgent({
      ...deps(),
      signMessageAsync: d.signMessageAsync,
      signTypedDataAsync: d.signTypedDataAsync,
      postApprove: d.postApprove,
      knownAgentAddress: first.agentAddress,
    });
    expect(second.skipped).toBe(true);
    expect(second.agentAddress).toBe(first.agentAddress);
    expect(d.signMessageAsync).toHaveBeenCalledTimes(1);
    expect(d.signTypedDataAsync).toHaveBeenCalledTimes(1);
    expect(d.postApprove).toHaveBeenCalledTimes(1);
  });

  it("sign-out clears the session keys so derivation prompts again", async () => {
    const d = deps();
    await runApproveAgent(d);
    expect(d.signMessageAsync).toHaveBeenCalledTimes(1);

    // What XIdentityControl.disconnect does on sign-out (D-024).
    clearSessionKeys();

    const after = await runApproveAgent({
      ...deps(),
      signMessageAsync: d.signMessageAsync,
      signTypedDataAsync: d.signTypedDataAsync,
      postApprove: d.postApprove,
    });
    // Derivation cache gone: the wallet is asked again. The stored key is
    // also gone from memory (and unreachable in this runner), so a fresh
    // agent is approved rather than silently reusing a dead one.
    expect(d.signMessageAsync).toHaveBeenCalledTimes(2);
    expect(after.skipped).toBeUndefined();
    expect(d.postApprove).toHaveBeenCalledTimes(2);
  });
});

/**
 * EIP-712 validity against the real viem (2.57.2), not a mock. The first
 * Take failed here: the types object keyed the struct "HyperliquidTransaction"
 * while primaryType read "HyperliquidTransaction:ApproveAgent", and viem
 * threw before any wallet popup could open.
 */
const TEST_KEY = generatePrivateKey();
const AGENT = privateKeyToAccount(TEST_KEY).address;

describe("approveAgent typed data vs viem", () => {
  it("reproduces the operator failure: legacy key throws the exact viem error", async () => {
    const account = privateKeyToAccount(TEST_KEY);
    // The pre-fix shape, inlined so this test pins the diagnosis even
    // after the constant is corrected.
    const legacy = {
      domain: {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: 42161,
        verifyingContract: "0x0000000000000000000000000000000000000000" as const,
      },
      types: {
        HyperliquidTransaction: [
          { name: "hyperliquidChain", type: "string" },
          { name: "signatureChainId", type: "string" },
          { name: "agentAddress", type: "address" },
          { name: "nonce", type: "uint64" },
          { name: "isMainnet", type: "bool" },
        ],
      },
      primaryType: "HyperliquidTransaction:ApproveAgent",
      message: {
        hyperliquidChain: "Mainnet",
        signatureChainId: "0xa4b1",
        agentAddress: AGENT,
        nonce: 1760000000000n,
        isMainnet: true,
      },
    } as const;
    await expect(
      (account.signTypedData as (args: unknown) => Promise<`0x${string}`>)({
        domain: legacy.domain,
        types: legacy.types,
        primaryType: legacy.primaryType,
        message: legacy.message,
      }),
    ).rejects.toThrow(
      /Invalid primary type `HyperliquidTransaction:ApproveAgent` must be one of/,
    );
  });

  it("the built payload carries its primary type and signs cleanly", async () => {    const payload = buildApproveAgentTypedData({
      agentAddress: AGENT,
      nonce: 1760000000000,
    });
    expect(payload.primaryType).toBe("HyperliquidTransaction:ApproveAgent");
    expect(payload.types[payload.primaryType]).toBeDefined();
    expect(payload.message).toEqual({
      hyperliquidChain: "Mainnet",
      agentAddress: AGENT,
      agentName: "",
      nonce: 1760000000000n,
    });

    const account = privateKeyToAccount(TEST_KEY);
    const sig = await (
      account.signTypedData as (args: unknown) => Promise<`0x${string}`>
    )({
      domain: payload.domain,
      types: payload.types,
      primaryType: payload.primaryType,
      message: payload.message,
    });
    // 65-byte ECDSA signature as 0x hex. That it exists means viem
    // accepted domain, types, primary type and message together.
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/);
  });

  it("builds a Testnet-labelled payload when asked (domain follows the venue)", () => {
    const payload = buildApproveAgentTypedData({
      agentAddress: AGENT,
      nonce: 1760000000000,
      chain: "Testnet",
    });
    // The HyperliquidSignTransaction domain chain id follows the action's
    // signatureChainId numerically (both reference SDKs): testnet posts
    // "0x66eee", so the domain is 421614 — NOT the mainnet 42161. Signing
    // testnet under 42161 was the live "Must deposit … User: 0x<garbage>"
    // failure: HL reconstructs with 421614 and recovery misses every time.
    expect(payload.domain.chainId).toBe(421614);
    expect(payload.message.hyperliquidChain).toBe("Testnet");
  });

  it("builds a Mainnet-labelled payload by default (domain stays 42161)", () => {
    const payload = buildApproveAgentTypedData({
      agentAddress: AGENT,
      nonce: 1760000000000,
    });
    expect(payload.domain.chainId).toBe(42161);
    expect(payload.message.hyperliquidChain).toBe("Mainnet");
  });
});

describe("isMemoryKeyApprovedFor", () => {
  it("matches the key that derives to the recorded agent", () => {
    expect(isMemoryKeyApprovedFor(AGENT, TEST_KEY)).toBe(true);
  });

  it("rejects a rotated key against the stale recorded agent (bug A)", () => {
    const rotated = generatePrivateKey();
    expect(privateKeyToAccount(rotated).address).not.toBe(AGENT);
    expect(isMemoryKeyApprovedFor(AGENT, rotated)).toBe(false);
  });

  it("is case-insensitive and null-safe", () => {
    expect(isMemoryKeyApprovedFor(AGENT.toUpperCase(), TEST_KEY)).toBe(true);
    expect(isMemoryKeyApprovedFor(null, TEST_KEY)).toBe(false);
    expect(isMemoryKeyApprovedFor(AGENT, null)).toBe(false);
    expect(isMemoryKeyApprovedFor(AGENT, "0xdead" as `0x${string}`)).toBe(false);
  });
});

describe("isUserRejection", () => {
  it("recognizes wallet-reported cancellations", () => {
    expect(
      isUserRejection(
        Object.assign(new Error("User rejected the request."), {
          name: "UserRejectedRequestError",
          code: 4001,
        }),
      ),
    ).toBe(true);
  });

  it("does NOT mistake a server rejection for a cancellation", () => {
    // The exact failure this mislabelled: the signatures succeeded, the
    // relay failed, and the message contains "rejected".
    expect(
      isUserRejection(
        Object.assign(
          new Error("Hyperliquid rejected the agent approval: Invalid signature."),
          { code: "SIGNATURE_REJECTED" },
        ),
      ),
    ).toBe(false);
    expect(isUserRejection(new Error("Request failed"))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
  });
});

describe("runApproveAgent pins the master account", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    (window as unknown as { ethereum?: unknown }).ethereum = {
      selectedAddress: ADDR,
    };
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("passes account === the connected address to both signatures", async () => {
    const signMessageAsync = vi.fn(async () => "0xderivationsecret");
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      signMessageAsync,
      signTypedDataAsync,
      postApprove: async () => ({}),
    });
    // Derivation signature: master wallet, explicitly.
    expect(signMessageAsync).toHaveBeenCalledWith(
      expect.objectContaining({ account: ADDR }),
    );
    // approveAgent signature: master wallet, explicitly — never a derived
    // key, never a cached walletClient bound to a stale account (D-019.1).
    const typedCall = signTypedDataAsync.mock.calls[0] as unknown as
      | [{ account: string; primaryType: string }]
      | undefined;
    expect(typedCall?.[0].account).toBe(ADDR);
    expect(typedCall?.[0].primaryType).toBe("HyperliquidTransaction:ApproveAgent");
  });
});

describe("runApproveAgent venue chain", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    (window as unknown as { ethereum?: unknown }).ethereum = {
      selectedAddress: ADDR,
    };
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("signs the approval with the Testnet label when the venue is testnet", async () => {
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove: async () => ({}),
    });
    const typedCall = signTypedDataAsync.mock.calls[0] as unknown as
      | [{ message: { hyperliquidChain: string } }]
      | undefined;
    const typed = typedCall?.[0];
    expect(typed?.message.hyperliquidChain).toBe("Testnet");
  });

  it("signs the approval with the Mainnet label when the venue is mainnet", async () => {
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Mainnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove: async () => ({}),
    });
    const typedCall = signTypedDataAsync.mock.calls[0] as unknown as
      | [{ message: { hyperliquidChain: string } }]
      | undefined;
    const typed = typedCall?.[0];
    expect(typed?.message.hyperliquidChain).toBe("Mainnet");
  });

  it("passes the venue domain into the wallet signature (421614 on testnet)", async () => {
    // Regression guard for the live failure: the builder fix is worthless
    // if runApproveAgent signed a differently-domained payload. The wallet
    // must receive domain 421614 with the Testnet label together.
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      chain: "Testnet",
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove: async () => ({}),
    });
    const typedCall = signTypedDataAsync.mock.calls[0] as unknown as
      | [{ domain: { chainId: number }; message: { hyperliquidChain: string } }]
      | undefined;
    expect(typedCall?.[0].domain.chainId).toBe(421614);
    expect(typedCall?.[0].message.hyperliquidChain).toBe("Testnet");
  });
});

/**
 * Signer-mismatch guard: the approval must be signed by the wagmi-connected
 * master wallet. When the injected wallet's selected address disagrees,
 * runApproveAgent throws before any signature is produced — it never lets
 * the venue recover an unknown signer.
 */
describe("runApproveAgent signer guard", () => {
  beforeEach(async () => {
    await forgetAgentKey();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("throws the mismatch error and never signs when the injected wallet disagrees", async () => {
    (window as unknown as { ethereum?: unknown }).ethereum = {
      selectedAddress: OTHER,
    };
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    const postApprove = vi.fn(async () => ({}));
    await expect(
      runApproveAgent({
        accountId: "acct-1",
        address: ADDR,
        signMessageAsync: async () => "0xderivationsecret",
        signTypedDataAsync,
        postApprove,
      }),
    ).rejects.toThrow(
      `Signer mismatch: wagmi has ${ADDR.toLowerCase()}, injected wallet has ${OTHER.toLowerCase()}`,
    );
    expect(signTypedDataAsync).not.toHaveBeenCalled();
    expect(postApprove).not.toHaveBeenCalled();
  });

  it("throws when no injected wallet exposes a selected address", async () => {
    delete (window as unknown as { ethereum?: unknown }).ethereum;
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    await expect(
      runApproveAgent({
        accountId: "acct-1",
        address: ADDR,
        signMessageAsync: async () => "0xderivationsecret",
        signTypedDataAsync,
        postApprove: async () => ({}),
      }),
    ).rejects.toThrow(/Signer mismatch/);
    expect(signTypedDataAsync).not.toHaveBeenCalled();
  });

  it("signs with account === the connected address when the wallet agrees", async () => {
    (window as unknown as { ethereum?: unknown }).ethereum = {
      selectedAddress: ADDR,
    };
    const signTypedDataAsync = vi.fn(async () => FLAT_SIG);
    await runApproveAgent({
      accountId: "acct-1",
      address: ADDR,
      signMessageAsync: async () => "0xderivationsecret",
      signTypedDataAsync,
      postApprove: async () => ({}),
    });
    const typedCall = signTypedDataAsync.mock.calls[0] as unknown as
      | [{ account: string }]
      | undefined;
    expect(typedCall?.[0].account).toBe(ADDR);
  });
});

/**
 * Canonical-shape regression (testnet "Must deposit … User: 0x<garbage>").
 *
 * Hyperliquid reconstructs the signed hash from the relayed action with the
 * reference-SDK rules: the EIP-712 domain chain id is the action's
 * signatureChainId parsed numerically (42161 on mainnet, 421614 on
 * testnet), and the message is exactly the four typed fields. Any
 * divergence — a fixed 42161 domain on testnet, a renamed/retyped field —
 * recovers to a different garbage address on every attempt. These tests pin
 * PASS's built payload against a fixed fixture, against the SDK's own
 * `ApproveAgentTypes`, and against a signature produced the SDK way.
 */
const FIXTURE_AGENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const FIXTURE_NONCE = 1760000000000;

describe("approveAgent canonical shape (fixture pin)", () => {
  it("builds the exact mainnet typed data for the fixture", () => {
    expect(buildApproveAgentTypedData({ agentAddress: FIXTURE_AGENT, nonce: FIXTURE_NONCE })).toEqual({
      domain: {
        name: "HyperliquidSignTransaction",
        version: "1",
        chainId: 42161,
        verifyingContract: "0x0000000000000000000000000000000000000000",
      },
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        "HyperliquidTransaction:ApproveAgent": [
          { name: "hyperliquidChain", type: "string" },
          { name: "agentAddress", type: "address" },
          { name: "agentName", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      },
      primaryType: "HyperliquidTransaction:ApproveAgent",
      message: {
        hyperliquidChain: "Mainnet",
        agentAddress: FIXTURE_AGENT,
        agentName: "",
        nonce: BigInt(FIXTURE_NONCE),
      },
    });
  });

  it("builds the exact testnet typed data for the fixture", () => {
    const payload = buildApproveAgentTypedData({
      agentAddress: FIXTURE_AGENT,
      nonce: FIXTURE_NONCE,
      chain: "Testnet",
    });
    // Only the venue-driven fields move: domain 421614 (= 0x66eee) and the
    // "Testnet" label. Everything else is byte-identical to mainnet.
    expect(payload.domain).toEqual({
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: 421614,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    });
    expect(payload.message).toEqual({
      hyperliquidChain: "Testnet",
      agentAddress: FIXTURE_AGENT,
      agentName: "",
      nonce: BigInt(FIXTURE_NONCE),
    });
    expect(payload.primaryType).toBe("HyperliquidTransaction:ApproveAgent");
  });

  it("matches the SDK's ApproveAgentTypes field for field", () => {
    const payload = buildApproveAgentTypedData({
      agentAddress: FIXTURE_AGENT,
      nonce: FIXTURE_NONCE,
      chain: "Testnet",
    });
    expect(payload.types["HyperliquidTransaction:ApproveAgent"]).toEqual(
      ApproveAgentTypes["HyperliquidTransaction:ApproveAgent"],
    );
  });

  it("signs and recovers to the test key on both venues", async () => {
    const account = privateKeyToAccount(TEST_KEY);
    for (const chain of ["Mainnet", "Testnet"] as const) {
      const payload = buildApproveAgentTypedData({
        agentAddress: FIXTURE_AGENT,
        nonce: FIXTURE_NONCE,
        chain,
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
    }
  });

  it("an SDK-produced signature verifies against PASS's built payload", async () => {
    // The strongest hash-equality proof available without funds: sign the
    // canonical way (SDK builds domain from signatureChainId, filters the
    // full action down to the four typed fields) and recover against the
    // payload PASS asks Rabby to sign. If either side hashed differently,
    // recovery misses.
    const account = privateKeyToAccount(TEST_KEY);
    for (const [chain, signatureChainId] of [
      ["Mainnet", "0xa4b1"],
      ["Testnet", "0x66eee"],
    ] as const) {
      const passPayload = buildApproveAgentTypedData({
        agentAddress: FIXTURE_AGENT,
        nonce: FIXTURE_NONCE,
        chain,
      });
      // The SDK rule, asserted as a rule rather than a constant: the domain
      // PASS builds must equal parseInt of the relayed signatureChainId.
      expect(passPayload.domain.chainId).toBe(Number.parseInt(signatureChainId, 16));
      const sdkSignature = await signUserSignedAction({
        wallet: account,
        action: {
          type: "approveAgent",
          signatureChainId,
          hyperliquidChain: chain,
          agentAddress: FIXTURE_AGENT,
          agentName: "",
          nonce: FIXTURE_NONCE,
        },
        types: ApproveAgentTypes,
      });
      const flat =
        `0x${sdkSignature.r.slice(2)}${sdkSignature.s.slice(2)}${sdkSignature.v.toString(16).padStart(2, "0")}` as `0x${string}`;
      const recovered = await recoverTypedDataAddress({
        domain: passPayload.domain,
        types: passPayload.types,
        primaryType: passPayload.primaryType,
        message: passPayload.message,
        signature: flat,
      } as never);
      expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
    }
  });
});
