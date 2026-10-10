import { beforeEach, describe, expect, it, vi } from "vitest";

import { forgetAgentKey, hasAgentKeyInMemory } from "../lib/agent-keystore";
import { runApproveAgent } from "../lib/approve-agent";

/**
 * First-execution approval with injected signing: no wallet, no network.
 * The key never appears in the posted body — only its address does.
 */
const ADDR = "0x1234567890abcdef1234567890abcdef12345678" as const;

describe("runApproveAgent", () => {
  beforeEach(async () => {
    await forgetAgentKey();
  });

  it("posts only address/nonce/signature and holds the key in memory", async () => {
    const postApprove = vi.fn(async () => ({ agentAddress: undefined }));
    const signMessageAsync = vi.fn(async () => "0xderivationsecret");
    const signTypedDataAsync = vi.fn(async () => "0xsignature" as const);

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
    expect(typeof typed?.message.nonce).toBe("bigint");

    // Only the address and the signature leave the client.
    expect(postApprove).toHaveBeenCalledTimes(1);
    const postCall = postApprove.mock.calls[0] as unknown as
      | [string, Record<string, unknown>]
      | undefined;
    const [id, body] = postCall ?? ["", {}];
    expect(id).toBe("acct-1");
    expect(body.agentAddress).toBe(done.agentAddress);
    expect(body.signature).toBe("0xsignature");
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
    const signTypedDataAsync = vi.fn(async () => "0xsig" as const);

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
        signTypedDataAsync: async () => "0xsig" as const,
        postApprove,
      }),
    ).rejects.toThrow("SIGNATURE_REJECTED");
    // persistAgentKey never ran, so no generated key lingers in memory.
    expect(hasAgentKeyInMemory()).toBe(false);
  });
});
