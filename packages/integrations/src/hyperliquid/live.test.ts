import { describe, expect, it, vi } from "vitest";

import { SplitHyperliquid } from "./live.js";

/**
 * D-021: `HYPERLIQUID_MODE` used to gate reads AND writes through one flag, so
 * asking for live prices armed `relaySignedAction` — a real signed order
 * against mainnet. These tests exist so that coupling cannot be reintroduced by
 * a well-meaning edit to the factory.
 */
const INFO = "https://api.hyperliquid.xyz/info";
const EXCHANGE = "https://api.hyperliquid.xyz/exchange";

function stubFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("SplitHyperliquid mode matrix", () => {
  it("reports live reads and mock execution in the split state", () => {
    const hl = new SplitHyperliquid({
      infoUrl: INFO,
      exchangeUrl: EXCHANGE,
      readsLive: true,
      writesLive: false,
    });
    expect(hl.readsMode).toBe("live");
    expect(hl.writesMode).toBe("mock");
    // The combined mode stays conservative, so any consumer that has not been
    // updated still sees "not fully live".
    expect(hl.mode).toBe("mock");
  });

  it("REFUSES live writes with mock reads", () => {
    // Simulated prices with real orders is the one state that must not exist.
    expect(
      () =>
        new SplitHyperliquid({
          infoUrl: INFO,
          exchangeUrl: EXCHANGE,
          readsLive: false,
          writesLive: true,
        }),
    ).toThrow(/real orders must never be placed against simulated prices/i);
  });

  it("is fully mock when both flags are off", () => {
    const hl = new SplitHyperliquid({ readsLive: false, writesLive: false });
    expect(hl.readsMode).toBe("mock");
    expect(hl.writesMode).toBe("mock");
    expect(hl.mode).toBe("mock");
  });

  it("is live only when both halves are live", () => {
    const hl = new SplitHyperliquid({
      infoUrl: INFO,
      exchangeUrl: EXCHANGE,
      readsLive: true,
      writesLive: true,
    });
    expect(hl.mode).toBe("live");
  });

  it("downgrades reads to mock when the Info URL is absent", () => {
    // Belt and braces: a flag with no URL must not half-construct a client.
    const hl = new SplitHyperliquid({ readsLive: true, writesLive: false });
    expect(hl.readsMode).toBe("mock");
  });
});

describe("SplitHyperliquid simulates execution in the split state", () => {
  it("simulates a successful relay instead of posting it", async () => {
    const fetchMock = stubFetch();
    const hl = new SplitHyperliquid({
      infoUrl: INFO,
      exchangeUrl: EXCHANGE,
      readsLive: true,
      writesLive: false,
    });

    const result = await hl.relaySignedAction({
      exchangeRequest: { type: "order", signature: "x" },
      signature: { r: "0x0", s: "0x0", v: 27 },
    } as never);

    expect(result.status).toBe("pending");
    expect(result.providerOrderId.startsWith("mock_")).toBe(true);
    expect(result.simulated).toBe(true);
    // The decisive assertion: nothing was sent anywhere.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses agent approval instead of signing it", async () => {
    const fetchMock = stubFetch();
    const hl = new SplitHyperliquid({
      infoUrl: INFO,
      exchangeUrl: EXCHANGE,
      readsLive: true,
      writesLive: false,
    });

    const result = await hl.relayApproveAgent({
      agentAddress: "0xagent",
      nonce: 1,
      signature: { r: "0x0", s: "0x0", v: 27 },
    });

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("live mode still attempts the real request path", async () => {    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ status: "ok", response: { type: "order", data: { statuses: [{ resting: { oid: 123 } }] } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const hl = new SplitHyperliquid({
      infoUrl: INFO,
      exchangeUrl: EXCHANGE,
      readsLive: true,
      writesLive: true,
    });

    await hl.relaySignedAction({
      exchangeRequest: {
        action: { type: "order", orders: [], grouping: "na" },
        nonce: Date.now(),
      },
      signature: { r: "0x0", s: "0x0", v: 27 },
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("exchange");
  });
});

describe("SplitHyperliquid reads through the Info API when reads are live", () => {
  it("hits the configured Info URL for mids", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ BTC: "113412.5" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const hl = new SplitHyperliquid({
      infoUrl: INFO,
      exchangeUrl: EXCHANGE,
      readsLive: true,
      writesLive: false,
    });

    const mids = await hl.getMids();

    expect(mids.BTC).toBe("113412.5");
    const url = String(fetchMock.mock.calls[0]?.[0] ?? "");
    expect(url).toBe(INFO);
    // Reads go to the Info endpoint, never the exchange one.
    expect(url).not.toContain("exchange");
  });

  it("refuses reads loudly in the mock state rather than returning a fixture", () => {
    stubFetch();
    const hl = new SplitHyperliquid({ readsLive: false, writesLive: false });

    // The API falls back to MockHyperliquid for the all-mock case, so reaching
    // this guard means a wiring fault. It must be loud, not silently empty.
    // Synchronous, because `getMids` is not `async` and therefore throws before
    // returning a promise.
    expect(() => hl.getMids()).toThrow(/wiring fault/i);
  });
});

describe("approveAgent venue label", () => {
  const TESTNET_EXCHANGE = "https://api.hyperliquid-testnet.xyz/exchange";

  function stubApproveOk(): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok", response: { type: "default" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function postedAction(fetchMock: ReturnType<typeof vi.fn>) {
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
      action?: Record<string, unknown>;
    };
    return body.action ?? {};
  }

  it("posts the approval to the configured exchange URL with the Testnet label", async () => {
    const fetchMock = stubApproveOk();
    const hl = new SplitHyperliquid({
      infoUrl: "https://api.hyperliquid-testnet.xyz/info",
      exchangeUrl: TESTNET_EXCHANGE,
      readsLive: true,
      writesLive: true,
    });

    const result = await hl.relayApproveAgent({
      agentAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      nonce: 1760000000000,
      signature: { r: "0x0", s: "0x0", v: 27 },
      hyperliquidChain: "Testnet",
    });

    expect(result.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toBe(TESTNET_EXCHANGE);
    expect(postedAction(fetchMock).hyperliquidChain).toBe("Testnet");
    expect(postedAction(fetchMock).signatureChainId).toBe("0x66eee");
    expect(postedAction(fetchMock).agentName).toBe("");
  });

  it("defaults the label to Mainnet for callers with no venue context", async () => {
    const fetchMock = stubApproveOk();
    const hl = new SplitHyperliquid({
      infoUrl: INFO,
      exchangeUrl: EXCHANGE,
      readsLive: true,
      writesLive: true,
    });

    await hl.relayApproveAgent({
      agentAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      nonce: 1760000000000,
      signature: { r: "0x0", s: "0x0", v: 27 },
    });

    expect(postedAction(fetchMock).hyperliquidChain).toBe("Mainnet");
    expect(postedAction(fetchMock).signatureChainId).toBe("0xa4b1");
  });
});