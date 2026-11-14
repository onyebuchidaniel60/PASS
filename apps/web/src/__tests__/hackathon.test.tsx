import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentAccess } from "@/components/AgentAccess";
import { FundWithAnyChain, type FundingQuote } from "@/components/FundWithAnyChain";
import { SecuritySection } from "@/components/SecuritySection";

const signTypedDataAsync = vi.fn();
let wallet = { isConnected: true, address: "0x1234567890abcdef1234567890abcdef12345678" as const };

vi.mock("wagmi", () => ({
  useAccount: () => wallet,
  useSignTypedData: () => ({ signTypedDataAsync }),
}));

const QUOTE: FundingQuote = {
  depositAddress: "0xc0abcdefabcdefabcdefabcdefabcdefabcdefab",
  confidentiality: "basic",
  source: { chain: "ethereum", token: "USDC", amount: "100" },
  destination: {
    chain: "hypercore",
    address: "0x1234567890abcdef1234567890abcdef12345678",
  },
  quote: {
    amountIn: "100000000",
    amountInFormatted: "100.0",
    amountOut: "99673098",
    minAmountOut: "98673267",
    deadline: new Date(Date.now() + 600_000).toISOString(),
    timeEstimate: 55,
    depositAddress: "0xc0abcdefabcdefabcdefabcdefabcdefabcdefab",
  },
  transactionPayload: {
    to: "0xc0abcdefabcdefabcdefabcdefabcdefabcdefab",
    chain: "eth",
    asset: "nep141:usdc",
    amount: "100000000",
    memo: null,
    quoteSignature: "sig",
  },
};

beforeEach(() => {
  localStorage.clear();
  wallet = { isConnected: true, address: "0x1234567890abcdef1234567890abcdef12345678" };
  signTypedDataAsync.mockReset();
});

describe("NEAR Intents funding modal", () => {
  it("renders the privacy toggle, note, and Powered by NEAR Intents badge", () => {
    render(
      <FundWithAnyChain open onClose={() => {}} destinationAddress={QUOTE.destination.address} />,
    );
    expect(screen.getByText("Powered by NEAR Intents")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Confidential deposits hide the link between your funding wallet and your PASS trading account.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Use Confidential Intents (Privacy)" }),
    ).toBeInTheDocument();
  });

  it("requests a confidential quote and shows the deposit address", async () => {
    const onQuote = vi.fn(async () => QUOTE);
    const onConfidentialUsed = vi.fn();
    render(
      <FundWithAnyChain
        open
        onClose={() => {}}
        destinationAddress={QUOTE.destination.address}
        onQuote={onQuote}
        onConfidentialUsed={onConfidentialUsed}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "100" } });
    fireEvent.click(
      screen.getByRole("switch", { name: "Use Confidential Intents (Privacy)" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Get deposit address" }));

    await waitFor(() =>
      expect(onQuote).toHaveBeenCalledWith({
        sourceChain: "ethereum",
        sourceToken: "USDC",
        destinationAddress: QUOTE.destination.address,
        amount: "100",
        isConfidential: true,
      }),
    );
    expect(await screen.findByTestId("funding-quote")).toHaveTextContent(
      QUOTE.depositAddress,
    );
    expect(onConfidentialUsed).toHaveBeenCalled();
  });

  it("keeps the quote when the parent privacy preference flips after success", async () => {
    const onQuote = vi.fn(async () => QUOTE);
    const { rerender } = render(
      <FundWithAnyChain
        open
        onClose={() => {}}
        destinationAddress={QUOTE.destination.address}
        onQuote={onQuote}
      />,
    );
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Get deposit address" }));
    expect(await screen.findByTestId("funding-quote")).toHaveTextContent(
      QUOTE.depositAddress,
    );

    rerender(
      <FundWithAnyChain
        open
        onClose={() => {}}
        destinationAddress={QUOTE.destination.address}
        onQuote={onQuote}
        defaultConfidential
      />,
    );
    expect(screen.getByTestId("funding-quote")).toHaveTextContent(QUOTE.depositAddress);
  });

  it("changes the token list with the selected chain", () => {
    render(
      <FundWithAnyChain open onClose={() => {}} destinationAddress={QUOTE.destination.address} />,
    );
    fireEvent.change(screen.getByLabelText("Source chain"), {
      target: { value: "solana" },
    });
    expect(screen.getByLabelText("Token")).toHaveValue("USDC");
    fireEvent.change(screen.getByLabelText("Token"), { target: { value: "SOL" } });
    expect(screen.getByLabelText("Token")).toHaveValue("SOL");
  });
});

describe("Agent Access", () => {
  const existingKey = {
    id: "key-1",
    name: "Existing Bot",
    prefix: "pass_agt_a1b2c3d4",
    createdAt: "2026-11-14T00:00:00.000Z",
    lastUsedAt: null,
  };

  it("loads keys and shows a newly generated plaintext key exactly once", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const loadKeys = vi.fn(async () => ({ keys: [existingKey] }));
    const createKey = vi.fn(async (name: string) => ({
      id: "key-2",
      name,
      prefix: "pass_agt_12345678",
      createdAt: "2026-11-14T01:00:00.000Z",
      lastUsedAt: null,
      key: `pass_agt_${"a".repeat(64)}`,
    }));
    const revokeKey = vi.fn();

    render(
      <AgentAccess
        loadKeys={loadKeys}
        createKey={createKey}
        revokeKey={revokeKey}
      />,
    );

    expect(await screen.findByText("Existing Bot")).toBeInTheDocument();
    expect(screen.getByText("pass_agt_a1b2c3d4…")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Key name/), {
      target: { value: "Python Bot" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Key" }));

    expect(createKey).toHaveBeenCalledWith("Python Bot");
    const secret = await screen.findByTestId("agent-api-key");
    expect(secret).toHaveTextContent(`pass_agt_${"a".repeat(64)}`);
    expect(
      screen.getByText(
        "Copy this key now. You won't be able to see it again.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`pass_agt_${"a".repeat(64)}`),
    );
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("revokes a key and removes it from the active list", async () => {
    const loadKeys = vi.fn(async () => ({ keys: [existingKey] }));
    const revokeKey = vi.fn(async () => ({ ok: true as const, id: existingKey.id }));
    render(
      <AgentAccess loadKeys={loadKeys} revokeKey={revokeKey} />,
    );

    expect(await screen.findByText("Existing Bot")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(revokeKey).toHaveBeenCalledWith("key-1"));
    await waitFor(() => expect(screen.queryByText("Existing Bot")).toBeNull());
    expect(
      await screen.findByText(
        "Existing Bot revoked. It can no longer authenticate.",
      ),
    ).toBeInTheDocument();
  });
});

describe("Security dashboard", () => {
  const account = {
    id: "t1",
    accountAddress: "0x1234567890abcdef1234567890abcdef12345678",
    agentAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    venue: "mock",
    agentApproved: true,
  };

  it("shows Approved, the forbidden permissions, and the privacy badge", () => {
    render(
      <SecuritySection
        account={account}
        confidentialEnabled
        onConfidentialChange={() => {}}
      />,
    );
    expect(screen.getByTestId("agent-key-status")).toHaveTextContent("Approved");
    expect(screen.getByTestId("privacy-badge")).toHaveTextContent("Privacy Enabled");
    expect(screen.getByText("Cannot withdraw funds")).toBeInTheDocument();
    expect(screen.getByText("Cannot transfer tokens")).toBeInTheDocument();
    expect(screen.getByText("Cannot change account settings")).toBeInTheDocument();
  });

  it("requires confirmation, then revokes the agent key", async () => {
    const onRevoke = vi.fn(async () => undefined);
    const onRevoked = vi.fn();
    render(
      <SecuritySection
        account={account}
        confidentialEnabled={false}
        onConfidentialChange={() => {}}
        onRevoke={onRevoke}
        onRevoked={onRevoked}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke Agent Key" }));
    expect(screen.getByText(/Revoke PASS's agent key\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm revoke" }));

    await waitFor(() => expect(onRevoke).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onRevoked).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Agent key revoked/),
    ).toBeInTheDocument();
  });

  it("reads Not Approved when no agent is stored", () => {
    render(
      <SecuritySection
        account={{ ...account, agentAddress: null, agentApproved: false }}
        confidentialEnabled={false}
        onConfidentialChange={() => {}}
      />,
    );
    expect(screen.getByTestId("agent-key-status")).toHaveTextContent("Not Approved");
    expect(screen.getByRole("button", { name: "Revoke Agent Key" })).toBeDisabled();
  });
});
