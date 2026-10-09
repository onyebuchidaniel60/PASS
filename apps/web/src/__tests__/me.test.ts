import { describe, expect, it } from "vitest";

import { ethosConnection, hasTradingAccount, isXConnected, xConnection } from "@/lib/me";

/**
 * `xConnection` is the single derivation from the flat `/api/v1/me`
 * payload to the X entry. It must be total: any unknown shape yields
 * `null`, never a throw. The production crash it guards against was
 * `me.x.connected` read directly off the wire payload, which has no
 * nested `x` object.
 */
describe("xConnection", () => {
  it("returns the x entry from a flat payload", () => {
    expect(
      xConnection({
        connections: [
          { provider: "hyperliquid", connected: false, label: "no", displayOnly: false },
          {
            provider: "x",
            connected: true,
            label: "X connected · @turnttfup99",
            displayOnly: false,
            handle: "turnttfup99",
          },
        ],
      }),
    ).toEqual({
      provider: "x",
      connected: true,
      label: "X connected · @turnttfup99",
      displayOnly: false,
      handle: "turnttfup99",
    });
  });

  it("returns null when the entry is absent", () => {
    expect(xConnection({ connections: [] })).toBeNull();
  });

  it("never throws on unknown shapes", () => {
    expect(xConnection(null)).toBeNull();
    expect(xConnection(undefined)).toBeNull();
    expect(xConnection({} as never)).toBeNull();
    expect(xConnection({ connections: null } as never)).toBeNull();
  });
});

describe("onboarding selectors", () => {
  const me = {
    connections: [
      { provider: "x", connected: true, label: "x", displayOnly: false, handle: "t" },
      { provider: "ethos", connected: false, label: "e", displayOnly: true },
    ],
    tradingAccounts: [
      { id: "a", accountAddress: "0x1", agentAddress: null, isPrimary: true },
    ],
  };

  it("isXConnected needs a connected entry with a handle", () => {
    expect(isXConnected(me)).toBe(true);
    expect(isXConnected({ connections: [] })).toBe(false);
    expect(
      isXConnected({
        connections: [{ provider: "x", connected: true, label: "x", displayOnly: false }],
      }),
    ).toBe(false);
    expect(isXConnected(null)).toBe(false);
  });

  it("ethosConnection finds the ethos entry", () => {
    expect(ethosConnection(me)?.provider).toBe("ethos");
    expect(ethosConnection({ connections: [] })).toBeNull();
    expect(ethosConnection(null)).toBeNull();
  });

  it("hasTradingAccount reflects linked accounts", () => {
    expect(hasTradingAccount(me)).toBe(true);
    expect(hasTradingAccount({ tradingAccounts: [] })).toBe(false);
    expect(hasTradingAccount(null)).toBe(false);
  });
});
