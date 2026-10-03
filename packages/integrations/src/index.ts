import {
  ETHOS_REQUIRED_CREDS,
  HYPERLIQUID_REQUIRED_CREDS,
  X_REQUIRED_CREDS,
  isProduction,
  resolveMode,
  type AdapterModes,
  type ApiEnv,
} from "@pass/contracts";
import type { EthosPort, HyperliquidPort, XPort } from "./ports.js";
import { LiveHyperliquid } from "./hyperliquid/live.js";
import { LiveEthos } from "./ethos/live.js";
import { LiveX } from "./x/live.js";
import { MockEthos, MockHyperliquid, MockX } from "./mock.js";

export * from "./ports.js";
export * from "./mock.js";
export { LiveHyperliquid } from "./hyperliquid/live.js";
export { HyperliquidInfoClient } from "./hyperliquid/info.js";
export { HyperliquidExchangeClient } from "./hyperliquid/exchange.js";
export { LiveEthos } from "./ethos/live.js";
export { LiveX } from "./x/live.js";

export interface Adapters {
  hyperliquid: HyperliquidPort;
  ethos: EthosPort;
  x: XPort;
  modes: AdapterModes;
}

/**
 * Builds provider adapters from environment variables alone. No code change
 * and no rebuild is required to move a provider between mock and live.
 *
 * In production, a mode requested as `live` without credentials throws at
 * startup: mock mode is never silently promoted to production.
 */
export function createAdapters(env: ApiEnv, log: (m: string) => void = () => {}): Adapters {
  const hl = resolveMode(env, "hyperliquid", [...HYPERLIQUID_REQUIRED_CREDS]);
  const ethos = resolveMode(env, "ethos", [...ETHOS_REQUIRED_CREDS]);
  const x = resolveMode(env, "x", [...X_REQUIRED_CREDS]);

  for (const w of [hl.warning, ethos.warning, x.warning]) {
    if (w) log(w);
  }

  const hyperliquid: HyperliquidPort =
    hl.mode === "live" && env.HYPERLIQUID_INFO_URL && env.HYPERLIQUID_EXCHANGE_URL
      ? new LiveHyperliquid(env.HYPERLIQUID_INFO_URL, env.HYPERLIQUID_EXCHANGE_URL)
      : new MockHyperliquid();

  const ethosPort: EthosPort =
    ethos.mode === "live" && env.ETHOS_API_BASE_URL
      ? new LiveEthos(env.ETHOS_API_BASE_URL)
      : new MockEthos();

  const xPort: XPort = x.mode === "live" ? new LiveX() : new MockX();

  if (isProduction(env)) {
    log(
      `Provider modes — hyperliquid:${hyperliquid.mode} ethos:${ethosPort.mode} x:${xPort.mode}`,
    );
  }

  return {
    hyperliquid,
    ethos: ethosPort,
    x: xPort,
    modes: {
      hyperliquid: hyperliquid.mode,
      ethos: ethosPort.mode,
      x: xPort.mode,
      database: env.DATABASE_URL ? "live" : "mock",
    },
  };
}