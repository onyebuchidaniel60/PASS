import { describe, expect, it } from "vitest";
import { generatePrivateKey } from "viem/accounts";

import { buildExchangeRequest, signExchangeRequest } from "../lib/signer";
import { persistAgentKey, forgetAgentKey } from "../lib/agent-keystore";

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
    await forgetAgentKey();
    await expect(signExchangeRequest("live", REQUEST())).rejects.toThrow(
      /No agent key/,
    );
  });

  it("live mode with an agent key produces an L1 { r, s, v } signature", async () => {
    const key = generatePrivateKey();
    await persistAgentKey(key, "0x0000000000000000000000000000000000000000", "0xtest", null);
    const signed = await signExchangeRequest("live", REQUEST());
    expect(Object.keys(signed).sort()).toEqual(["exchangeRequest", "signature"]);
    expect(signed.signature).toMatchObject({ v: expect.any(Number) });
    expect(signed.signature.r).toMatch(/^0x[0-9a-f]{64}$/);
    expect(signed.signature.s).toMatch(/^0x[0-9a-f]{64}$/);
    expect([27, 28]).toContain(signed.signature.v);
    expect((signed.signature as { mock?: boolean }).mock).toBeUndefined();
    await forgetAgentKey();
  });
});
