import { describe, expect, it } from "vitest";

import { buildExchangeRequest, signExchangeRequest } from "../lib/signer";

/**
 * Signing boundary: mock envelopes are correctly shaped placeholders;
 * live mode without a key throws and sends nothing (fail closed).
 * No network is touched here — the relay lives server-side.
 */
const REQUEST = () =>
  buildExchangeRequest({
    assetIndex: 0,
    isBuy: true,
    size: "0.01102",
    limitPx: "113400",
    takeProfit: "116000",
    stopLoss: "111900",
  });

describe("signExchangeRequest", () => {
  it("mock mode produces the relay's envelope shape", async () => {
    const signed = await signExchangeRequest("mock", REQUEST());
    expect(Object.keys(signed).sort()).toEqual(["exchangeRequest", "signature"]);
    const action = (signed.exchangeRequest as { action: { type: string; orders: unknown[] } })
      .action;
    expect(action.type).toBe("order");
    expect(action.orders).toHaveLength(3);
    expect(typeof (signed.exchangeRequest as { nonce: number }).nonce).toBe("number");
    expect(signed.signature).toMatchObject({ v: 27, mock: true });
  });

  it("live mode without an agent key throws; no request exists to send", async () => {
    // Fresh module state holds no key (nothing persisted it in this file).
    await expect(signExchangeRequest("live", REQUEST())).rejects.toThrow(
      /No agent key/,
    );
  });
});
