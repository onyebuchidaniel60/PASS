import type {
  HLAccountState,
  HLAssetMeta,
  HLFill,
  HLOpenOrder,
  HLOrderBook,
  HLOrderStatus,
  HLRelayResult,
  MarketSnapshotDto,
  SignedPayload,
} from "@pass/contracts";
import type { HyperliquidPort } from "../ports.js";
import { HyperliquidExchangeClient } from "./exchange.js";
import { HyperliquidInfoClient } from "./info.js";

/**
 * Hyperliquid adapter whose READS and WRITES are gated independently.
 *
 * WHY THIS EXISTS (D-021)
 * -----------------------
 * `LiveHyperliquid` implemented the whole `HyperliquidPort` in one class behind
 * one flag, so `HYPERLIQUID_MODE=live` armed `relaySignedAction` — a real signed
 * order against mainnet — as a side effect of wanting live prices. That is one
 * env var away from executing real trades, which is exactly the class of
 * accident this product's self-custody model must not be able to have (AGENTS.md,
 * D-018.9).
 *
 * So the flag was split (`HYPERLIQUID_MODE` for writes, `HYPERLIQUID_READS_MODE`
 * for reads) and this class makes the resulting four states explicit:
 *
 *   reads  \\ writes
 *   mock   \\ mock     everything simulated (the pre-D-021 state)
 *   live   \\ mock     live market data, execution still a fixture  <-- the ask
 *   mock   \\ live     simulated prices, real orders — refuse this, see below
 *   live   \\ live     fully live
 *
 * The third row is rejected at construction. Simulated prices with real
 * execution is the one combination that can talk a Taker into an order on a
 * number that is not the market's.
 */
export class SplitHyperliquid implements HyperliquidPort {
  /** "live" only when BOTH halves are live. Reported to /health and the banner. */
  readonly mode: "live" | "mock";

  private readonly info: HyperliquidInfoClient | null;
  private readonly exchange: HyperliquidExchangeClient | null;

  /** Per-surface modes, for an honest banner. */
  readonly readsMode: "live" | "mock";
  readonly writesMode: "live" | "mock";

  constructor(params: {
    infoUrl?: string;
    exchangeUrl?: string;
    readsLive: boolean;
    writesLive: boolean;
  }) {
    if (params.writesLive && !params.readsLive) {
      throw new Error(
        "[hyperliquid] refusing to start: writes are live but reads are mock. " +
          "Real orders must never be placed against simulated prices. " +
          "Set HYPERLIQUID_READS_MODE=live as well.",
      );
    }

    this.readsMode = params.readsLive && params.infoUrl ? "live" : "mock";
    this.writesMode = params.writesLive && params.exchangeUrl ? "live" : "mock";

    this.info =
      this.readsMode === "live" && params.infoUrl
        ? new HyperliquidInfoClient(params.infoUrl)
        : null;
    this.exchange =
      this.writesMode === "live" && params.infoUrl && params.exchangeUrl
        ? new HyperliquidExchangeClient(params.exchangeUrl, this.info!)
        : null;

    this.mode = this.readsMode === "live" && this.writesMode === "live" ? "live" : "mock";
  }

  /** Uniform guard so no read can accidentally fall through to a live call. */
  private requireInfo(): HyperliquidInfoClient {
    if (!this.info) {
      throw new Error(
        "[hyperliquid] read requested while HYPERLIQUID_READS_MODE=mock. " +
          "This is a wiring fault, not a user error.",
      );
    }
    return this.info;
  }

  listAssets(): Promise<HLAssetMeta[]> {
    return this.requireInfo().listAssets();
  }

  getMids(): Promise<Record<string, string>> {
    return this.requireInfo().allMids();
  }

  getOrderBook(asset: string): Promise<HLOrderBook | null> {
    return this.requireInfo().l2Book(asset);
  }

  async getSnapshot(asset: string): Promise<MarketSnapshotDto | null> {
    const mids = await this.requireInfo().allMids();
    const px = mids[asset];
    if (px === undefined) return null;
    return {
      provider: "hyperliquid",
      asset,
      markPrice: px,
      midPrice: px,
      observedAt: new Date().toISOString(),
    };
  }

  getAccountState(accountAddress: string): Promise<HLAccountState | null> {
    return this.requireInfo().clearinghouseState(accountAddress);
  }

  getOpenOrders(accountAddress: string): Promise<HLOpenOrder> {
    return this.requireInfo().openOrders(accountAddress);
  }

  getFills(accountAddress: string): Promise<HLFill[]> {
    return this.requireInfo().userFills(accountAddress);
  }

  async getOrderStatus(providerOrderId: string): Promise<HLOrderStatus | null> {
    // Order status is a READ of the Info API, not an exchange write, so it
    // follows the reads flag. `orderStatusByOid` takes a bare oid, not a
    // provider id string, so parse defensively rather than blindly.
    const oid = Number(providerOrderId);
    if (!Number.isFinite(oid)) return null;
    return this.requireInfo().orderStatusByOid(oid);
  }

  /**
   * The only method that submits an order. Gated on the WRITES flag alone, and
   * unreachable while that flag is mock — which is the default and the state
   * this repository is deployed in.
   */
  async relaySignedAction(signed: SignedPayload): Promise<HLRelayResult> {
    if (!this.exchange) {
      // A rejection, not a throw: the Take flow surfaces this in its normal
      // rejection path (§10.6 Step 4) instead of an error page, which is the
      // right treatment for "this deployment does not place orders".
      return {
        providerOrderId: "",
        status: "rejected",
        rawStatus: {
          reason:
            "HYPERLIQUID_MODE=mock — order relay is disabled in this deployment.",
        },
      };
    }
    return this.exchange.relaySignedAction(signed);
  }

  async relayApproveAgent(params: {
    agentAddress: string;
    nonce: number;
    signature: Record<string, unknown>;
  }): Promise<{ ok: boolean; raw?: unknown }> {
    if (!this.exchange) {
      return {
        ok: false,
        raw: {
          reason: "HYPERLIQUID_MODE=mock — agent approval is disabled in this deployment.",
        },
      };
    }
    return this.exchange.relayApproveAgent(params);
  }
}

/**
 * Unchanged single-flag adapter, retained because it is the "both halves live"
 * case and it is what D-021's own decision record refers to. Prefer
 * `SplitHyperliquid` everywhere: the whole point of D-021 is that the two
 * surfaces should never be wired by the same call site.
 */
export class LiveHyperliquid extends SplitHyperliquid {
  constructor(infoUrl: string, exchangeUrl: string) {
    super({ infoUrl, exchangeUrl, readsLive: true, writesLive: true });
  }
}