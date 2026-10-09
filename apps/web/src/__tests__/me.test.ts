import { describe, expect, it } from "vitest";

import { xConnection } from "@/lib/me";

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
