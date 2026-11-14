import { describe, expect, it } from "vitest";

import type { AppContext } from "../context.js";
import { marketServiceConfig } from "./market-service.js";

/**
 * HIP-4 is live on Mainnet. The selector and the server read the same config,
 * so this pins the venue class list rather than letting a Mainnet-only
 * regression silently empty the outcome picker again.
 */
function ctx(exchangeUrl: string, execution: "live" | "mock" = "live") {
  return {
    adapters: { modes: { hyperliquidExecution: execution } },
    env: { HYPERLIQUID_EXCHANGE_URL: exchangeUrl },
  } as unknown as AppContext;
}

describe("marketServiceConfig", () => {
  it("enables perps and HIP-4 on Mainnet", () => {
    const config = marketServiceConfig(
      ctx("https://api.hyperliquid.xyz/exchange"),
    );
    expect(config.venue).toBe("mainnet");
    expect(config.enabledMarketClasses).toEqual(["perp", "hip4"]);
  });

  it("enables perps and HIP-4 on Testnet", () => {
    const config = marketServiceConfig(
      ctx("https://api.hyperliquid-testnet.xyz/exchange"),
    );
    expect(config.venue).toBe("testnet");
    expect(config.enabledMarketClasses).toEqual(["perp", "hip4"]);
  });

  it("keeps both classes available in mock mode", () => {
    const config = marketServiceConfig(
      ctx("https://api.hyperliquid.xyz/exchange", "mock"),
    );
    expect(config.venue).toBe("mock");
    expect(config.enabledMarketClasses).toEqual(["perp", "hip4"]);
  });
});
