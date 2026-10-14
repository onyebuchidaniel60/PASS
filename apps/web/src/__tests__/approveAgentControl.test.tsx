import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApproveAgentControl } from "../components/ApproveAgentControl";

/**
 * ApproveAgentControl venue derivation (branch fix/hyperliquid-agent-approval).
 *
 * Live reproduction: the wallet sat on Arbitrum Sepolia while the control
 * signed hyperliquidChain "Mainnet", because the /health fetch failed (or
 * the venue was not literally "testnet") and the code collapsed to its
 * "Mainnet" initial state. These tests pin the corrected behaviour:
 *  - venue unknown (/health unreachable) → approval blocked with a venue
 *    error, never a silent Mainnet signature;
 *  - venue testnet + matching wallet → the control passes chain "Testnet";
 *  - venue testnet + wrong-network wallet → a clear mismatch message naming
 *    both chains, and runApproveAgent is never called.
 */
const ADDR = "0x1234567890abcdef1234567890abcdef12345678";

const { mockGet, mockPost, mockWallet, mockRunApprove } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockWallet: vi.fn(),
  mockRunApprove: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockGet(...a),
  clientPost: (...a: unknown[]) => mockPost(...a),
}));

vi.mock("wagmi", () => ({
  useAccount: () => mockWallet(),
  useSignMessage: () => ({ signMessageAsync: vi.fn(async () => "0xsecret") }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn(async () => "0x") }),
}));

vi.mock("@/lib/approve-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/approve-agent")>();
  return {
    ...actual,
    runApproveAgent: (...a: unknown[]) => mockRunApprove(...a),
  };
});

function wallet(chainId: number) {
  mockWallet.mockReturnValue({ address: ADDR, isConnected: true, chainId });
}

describe("ApproveAgentControl venue derivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  it("/health unreachable blocks approval instead of silently signing Mainnet", async () => {
    mockGet.mockRejectedValueOnce(new Error("network down"));
    wallet(421614);
    render(<ApproveAgentControl accountAddress={ADDR} />);

    // The venue error surfaces and the button never enables: there is no
    // chain to sign with, so there is nothing to approve with.
    expect(
      await screen.findByText(/signing venue is unknown|Could not reach \/health/),
    ).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /Approve agent wallet/ });
    expect(button).toBeDisabled();
    expect(mockRunApprove).not.toHaveBeenCalled();
  });

  it("venue testnet + Sepolia wallet passes chain Testnet to runApproveAgent", async () => {
    mockGet.mockResolvedValueOnce({ hyperliquidVenue: "testnet" });
    wallet(421614);
    mockRunApprove.mockResolvedValueOnce({
      agentAddress: "0xagent",
      persisted: true,
    });
    render(<ApproveAgentControl accountAddress={ADDR} />);

    const button = await screen.findByRole("button", {
      name: /Approve agent wallet/,
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(mockRunApprove).toHaveBeenCalledTimes(1));
    expect(mockRunApprove.mock.calls[0]?.[0]).toMatchObject({
      chain: "Testnet",
    });
  });

  it("venue testnet + Arbitrum One wallet names both chains and never signs", async () => {
    mockGet.mockResolvedValueOnce({ hyperliquidVenue: "testnet" });
    wallet(42161);
    render(<ApproveAgentControl accountAddress={ADDR} />);

    const button = await screen.findByRole("button", {
      name: /Approve agent wallet/,
    });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    const msg = await screen.findByText(/Chain mismatch/);
    expect(msg.textContent).toContain("42161");
    expect(msg.textContent).toContain("421614");
    expect(mockRunApprove).not.toHaveBeenCalled();
  });
});
