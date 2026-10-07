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

describe("SplitHyperliquid keeps execution unreachable in the split state", () => {
  it("rejects an order instead of posting it", async () => {
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

    expect(result.status).toBe("rejected");
    expect(
      String((result.rawStatus as Record<string, unknown> | undefined)?.reason ?? ""),
    ).toMatch(/HYPERLIQUID_MODE=mock/);
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