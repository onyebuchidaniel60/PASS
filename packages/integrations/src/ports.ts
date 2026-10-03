import type {
  EthosReputation,
  HLAccountState,
  HLAssetMeta,
  HLFill,
  HLOpenOrder,
  HLOrderBook,
  HLOrderStatus,
  HLRelayResult,
  MarketSnapshotDto,
  RunMode,
  SignedPayload,
  XPostResult,
  XUser,
} from "@pass/contracts";

/**
 * Provider ports. Business logic depends on these interfaces and the
 * normalized DTOs in @pass/contracts, never on a raw provider payload
 * (docs/TECHNICAL_SPEC.md §6).
 */

export interface MarketDataPort {
  readonly mode: RunMode;
  listAssets(): Promise<HLAssetMeta[]>;
  getMids(): Promise<Record<string, string>>;
  getOrderBook(asset: string): Promise<HLOrderBook | null>;
  getSnapshot(asset: string): Promise<MarketSnapshotDto | null>;
}

export interface AccountDataPort {
  /**
   * accountAddress must be trading_accounts.account_address, never
   * agent_address (D-018.3, docs/TECHNICAL_SPEC.md §8).
   */
  getAccountState(accountAddress: string): Promise<HLAccountState | null>;
  getOpenOrders(accountAddress: string): Promise<HLOpenOrder>;
  getFills(accountAddress: string): Promise<HLFill[]>;
}

export interface ExchangePort {
  /**
   * Relays an already-signed payload to the Hyperliquid Exchange API.
   * This adapter never holds a private key (D-018.3, D-018.9).
   */
  relaySignedAction(signed: SignedPayload): Promise<HLRelayResult>;
  getOrderStatus(providerOrderId: string): Promise<HLOrderStatus | null>;
}

export interface HyperliquidPort
  extends MarketDataPort,
    AccountDataPort,
    ExchangePort {}

export interface XPort {
  readonly mode: RunMode;
  /** Display-only identity resolution. Requires no stored token. */
  resolveIdentity(handle: string): Promise<XUser | null>;
  /** Native post creation. Never required for sharing. */
  createPost(accessToken: string, text: string): Promise<XPostResult>;
  buildAuthorizationUrl(opts: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scope: string;
  }): string;
}

export interface EthosPort {
  readonly mode: RunMode;
  getReputation(profileRef: string): Promise<EthosReputation | null>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryable: boolean = true,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(provider: string, cause?: string) {
    super(`Provider ${provider} is unavailable${cause ? `: ${cause}` : ""}`, provider, true);
    this.name = "ProviderUnavailableError";
  }
}