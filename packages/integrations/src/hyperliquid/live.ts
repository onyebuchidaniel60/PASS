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
 * Live Hyperliquid adapter composed from the Info and Exchange clients.
 * Requires only read-only URLs (D-018.9): no API key, no agent key.
 */
export class LiveHyperliquid implements HyperliquidPort {
  readonly mode = "live" as const;
  private readonly info: HyperliquidInfoClient;
  private readonly exchange: HyperliquidExchangeClient;

  constructor(infoUrl: string, exchangeUrl: string) {
    this.info = new HyperliquidInfoClient(infoUrl);
    this.exchange = new HyperliquidExchangeClient(exchangeUrl, this.info);
  }

  listAssets(): Promise<HLAssetMeta[]> {
    return this.info.listAssets();
  }

  async getMids(): Promise<Record<string, string>> {
    return this.info.allMids();
  }

  getOrderBook(asset: string): Promise<HLOrderBook | null> {
    return this.info.l2Book(asset);
  }

  async getSnapshot(asset: string): Promise<MarketSnapshotDto | null> {
    const mids = await this.info.allMids();
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
    return this.info.clearinghouseState(accountAddress);
  }

  getOpenOrders(accountAddress: string): Promise<HLOpenOrder> {
    return this.info.openOrders(accountAddress);
  }

  getFills(accountAddress: string): Promise<HLFill[]> {
    return this.info.userFills(accountAddress);
  }

  relaySignedAction(signed: SignedPayload): Promise<HLRelayResult> {
    return this.exchange.relaySignedAction(signed);
  }

  relayApproveAgent(params: {
    agentAddress: string;
    nonce: number;
    signature: Record<string, unknown>;
  }): Promise<{ ok: boolean; raw?: unknown }> {
    return this.exchange.relayApproveAgent(params);
  }

  getOrderStatus(providerOrderId: string): Promise<HLOrderStatus | null> {
    return this.exchange.getOrderStatus(providerOrderId);
  }
}