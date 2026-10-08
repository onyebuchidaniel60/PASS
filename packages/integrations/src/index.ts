import {
  ETHOS_REQUIRED_CREDS,
  HYPERLIQUID_READS_REQUIRED_CREDS,
  HYPERLIQUID_REQUIRED_CREDS,
  X_REQUIRED_CREDS,
  isProduction,
  resolveMode,
  type AdapterModes,
  type ApiEnv,
} from "@pass/contracts";
import type { EthosPort, HyperliquidPort, XPort } from "./ports.js";
import { SplitHyperliquid } from "./hyperliquid/live.js";
import { LiveEthos } from "./ethos/live.js";
import { LiveX } from "./x/live.js";
import { MockEthos, MockHyperliquid, MockX } from "./mock.js";

export * from "./ports.js";
export * from "./mock.js";
export { LiveHyperliquid, SplitHyperliquid } from "./hyperliquid/live.js";
export { HyperliquidInfoClient } from "./hyperliquid/info.js";
export { HyperliquidExchangeClient } from "./hyperliquid/exchange.js";
export { LiveEthos } from "./ethos/live.js";
export { LiveX, redactX } from "./x/live.js";

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
  const hlReads = resolveMode(env, "hyperliquid_reads", [
    ...HYPERLIQUID_READS_REQUIRED_CREDS,
  ]);
  const ethos = resolveMode(env, "ethos", [...ETHOS_REQUIRED_CREDS]);
  const x = resolveMode(env, "x", [...X_REQUIRED_CREDS]);

  for (const w of [hl.warning, hlReads.warning, ethos.warning, x.warning]) {
    if (w) log(w);
  }

  /**
   * D-021: reads and writes are wired from SEPARATE flags.
   *
   * `writesLive` also requires reads, and `SplitHyperliquid` throws if writes
   * are live while reads are not — simulated prices with real orders is the one
   * combination that must never run.
   *
   * The whole-mock case still returns `MockHyperliquid`, so tests and local
   * development keep their fixtures unchanged.
   */
  const hyperliquid: HyperliquidPort =
    hl.mode === "mock" && hlReads.mode === "mock"
      ? new MockHyperliquid()
      : new SplitHyperliquid({
          infoUrl: env.HYPERLIQUID_INFO_URL,
          exchangeUrl: env.HYPERLIQUID_EXCHANGE_URL,
          readsLive: hlReads.mode === "live",
          // Writes require BOTH flags so the old single-flag live switch still
          // works, while the new read-only flag cannot arm an order by itself.
          writesLive: hl.mode === "live" && hlReads.mode === "live",
        });

  const ethosPort: EthosPort =
    ethos.mode === "live" && env.ETHOS_API_BASE_URL
      ? new LiveEthos(env.ETHOS_API_BASE_URL)
      : new MockEthos();

  const xPort: XPort = x.mode === "live" ? new LiveX() : new MockX();

  const readsMode =
    hyperliquid instanceof MockHyperliquid
      ? ("mock" as const)
      : (hyperliquid as SplitHyperliquid).readsMode;
  const executionMode =
    hyperliquid instanceof MockHyperliquid
      ? ("mock" as const)
      : (hyperliquid as SplitHyperliquid).writesMode;

  if (isProduction(env)) {
    log(
      `Provider modes — hyperliquid(reads):${readsMode} ` +
        `hyperliquid(execution):${executionMode} ethos:${ethosPort.mode} x:${xPort.mode}`,
    );
  }

  return {
    hyperliquid,
    ethos: ethosPort,
    x: xPort,
    modes: {
      hyperliquid: readsMode === "live" && executionMode === "live" ? "live" : "mock",
      hyperliquidReads: readsMode,
      hyperliquidExecution: executionMode,
      ethos: ethosPort.mode,
      x: xPort.mode,
      database: env.DATABASE_URL ? "live" : "mock",
    },
  };
}