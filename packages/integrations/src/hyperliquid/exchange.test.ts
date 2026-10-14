import { afterEach, describe, expect, it, vi } from "vitest";

import { HyperliquidExchangeClient } from "./exchange.js";
import { HyperliquidInfoClient } from "./info.js";

/**
 * Hyperliquid order-id extraction (branch fix/hyperliquid-agent-approval).
 *
 * Live symptom: POST /executions → 422 "Order relay is disabled in this
 * deployment." while /health reported execution live. The mode was live;
 * the message was wrong. HyperliquidExchangeClient extracted the oid from
 * `response.data.oid`, where Hyperliquid never returns it — the oid is
 * nested at `response.data.statuses[0].resting.oid` (resting) or
 * `response.data.statuses[0].filled.oid` (immediate fill). Extraction
 * returned "" and relayExecution mislabelled the empty id as "relay
 * disabled".
 */
const EXCHANGE = "https://api.hyperliquid-testnet.xyz/exchange";

function client() {
  return new HyperliquidExchangeClient(
    EXCHANGE,
    new HyperliquidInfoClient("https://api.hyperliquid-testnet.xyz/info"),
  );
}

function stubOk(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const SIGNED = {
  exchangeRequest: {
    action: { type: "order", orders: [], grouping: "na" },
    nonce: 1,
  },
  signature: { r: "0x0", s: "0x0", v: 27 },
} as never;

describe("relaySignedAction order-id extraction", () => {
  it("reads statuses[0].resting.oid (the real resting-order shape)", async () => {
    stubOk({
      status: "ok",
      response: {
        type: "order",
        data: { statuses: [{ resting: { oid: 123456, cloid: "0xabc" } }] },
      },
    });
    const result = await client().relaySignedAction(SIGNED);
    expect(result.providerOrderId).toBe("123456");
    expect(result.status).toBe("open");
    expect(result.simulated).toBe(false);
  });

  it("falls back to statuses[0].filled.oid (immediate fill)", async () => {
    stubOk({
      status: "ok",
      response: {
        type: "order",
        data: {
          statuses: [{ filled: { oid: 789, avgPx: "67000", totalSz: "0.01" } }],
        },
      },
    });
    const result = await client().relaySignedAction(SIGNED);
    expect(result.providerOrderId).toBe("789");
  });

  it("keeps the legacy data.oid / top-level oid shapes as last resort", async () => {
    stubOk({ status: "ok", response: { type: "order", data: { oid: 555 } } });
    expect((await client().relaySignedAction(SIGNED)).providerOrderId).toBe(
      "555",
    );
    stubOk({ status: "ok", oid: 666 });
    expect((await client().relaySignedAction(SIGNED)).providerOrderId).toBe(
      "666",
    );
  });

  it('status "ok" with no oid anywhere throws a distinct error, never an empty id', async () => {
    const raw = { status: "ok", response: { type: "order", data: { statuses: [] } } };
    stubOk(raw);
    const err = await client()
      .relaySignedAction(SIGNED)
      .then(
        () => null,
        (e: unknown) => e as Error,
      );
    expect(err).not.toBeNull();
    expect(String(err?.message)).toMatch(/could not read the order id/i);
    // Distinct from the mock-mode wording: this error means the exchange
    // answered without a parseable id, not that relaying is disabled.
    expect(String(err?.message)).not.toMatch(/relay is disabled/i);
    // The full raw response travels with the error for diagnosis.
    expect(String(err?.message)).toContain("statuses");
  });
});
