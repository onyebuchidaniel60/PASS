import type {
  EthosReputation,
  HLAccountState,
  HLAssetMeta,
  HLFill,
  HLOpenOrder,
  HLOrder,
  HLOrderBook,
  HLOrderStatus,
  HLRelayResult,
  MarketSnapshotDto,
  SignedPayload,
  XPostResult,
  XUser,
} from "@pass/contracts";
import { ProviderError } from "./ports.js";
import type {
  AccountDataPort,
  EthosPort,
  ExchangePort,
  HyperliquidPort,
  MarketDataPort,
  XPort,
} from "./ports.js";
import { toDecimalString } from "@pass/domain";

/**
 * Mock adapters. Response shapes mirror the real provider envelopes recorded
 * in docs/INTEGRATION_VERIFICATION.md so that swapping to live changes no
 * field names.
 *
 * Nothing here is presented as real performance data. Callers surface
 * `mode === "mock"` so the UI can label fixtures as demo data.
 */

const nowIso = () => new Date().toISOString();

/** Realistic perp magnitudes, not toy values. */
const MOCK_MIDS: Record<string, number> = {
  BTC: 113_412.5,
  ETH: 3_584.2,
  SOL: 178.94,
  ARB: 0.8123,
  OP: 1.6742,
};

const MOCK_ASSETS: HLAssetMeta[] = [
  { asset: "BTC", dex: "perp", assetId: 0, szDecimals: 5, maxLeverage: 40 },
  { asset: "ETH", dex: "perp", assetId: 1, szDecimals: 4, maxLeverage: 40 },
  { asset: "SOL", dex: "perp", assetId: 2, szDecimals: 2, maxLeverage: 20 },
  { asset: "ARB", dex: "perp", assetId: 3, szDecimals: 3, maxLeverage: 25 },
  { asset: "OP", dex: "perp", assetId: 4, szDecimals: 2, maxLeverage: 25 },
];

export class MockMarketData implements MarketDataPort {
  readonly mode = "mock" as const;

  async listAssets(): Promise<HLAssetMeta[]> {
    return MOCK_ASSETS;
  }

  async getMids(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [asset, px] of Object.entries(MOCK_MIDS)) {
      // Small deterministic wobble so the UI shows live-looking movement.
      const drift = 1 + (Date.now() % 97) / 10_000 - 0.004;
      out[asset] = toDecimalString(Number((px * drift).toFixed(2)));
    }
    return out;
  }

  async getOrderBook(asset: string): Promise<HLOrderBook | null> {
    const mid = MOCK_MIDS[asset];
    if (mid === undefined) return null;
    const step = mid * 0.0004;
    return {
      asset,
      observedAt: nowIso(),
      levels: [
        { price: toDecimalString(mid - step), size: "0.42" },
        { price: toDecimalString(mid - step * 2), size: "1.18" },
        { price: toDecimalString(mid + step), size: "0.55" },
        { price: toDecimalString(mid + step * 2), size: "2.03" },
      ],
    };
  }

  async getSnapshot(asset: string): Promise<MarketSnapshotDto | null> {
    const mid = MOCK_MIDS[asset];
    if (mid === undefined) return null;
    const px = toDecimalString(mid);
    return {
      provider: "hyperliquid",
      asset,
      markPrice: px,
      midPrice: px,
      observedAt: nowIso(),
    };
  }
}

export class MockAccountData implements AccountDataPort {
  readonly mode = "mock" as const;

  async getAccountState(accountAddress: string): Promise<HLAccountState> {
    // Deterministic per-address so repeated reads agree with each other.
    const seed = [...accountAddress].reduce((a, c) => a + c.charCodeAt(0), 0);
    const value = 5_000 + (seed % 40_000);
    return {
      accountAddress,
      accountValue: toDecimalString(value),
      withdrawable: toDecimalString(value * 0.82),
      marginUsed: toDecimalString(value * 0.18),
      observedAt: nowIso(),
    };
  }

  async getOpenOrders(accountAddress: string): Promise<HLOpenOrder> {
    return { accountAddress, orders: [] as HLOrder[], observedAt: nowIso() };
  }

  async getFills(accountAddress: string): Promise<HLFill[]> {
    return [
      {
        accountAddress,
        coin: "BTC",
        side: "buy",
        px: "113400.00",
        sz: "0.25",
        time: Math.floor(Date.now() / 1000) - 5400,
        oid: 900001,
        closedPnl: null,
        fee: "0.71",
        dir: "Open Long",
      },
    ];
  }
}

/**
 * Deterministic order ids so a repeated relay of the same clientRequestId
 * resolves to the same provider order id in mock mode.
 */
function mockOrderId(signed: SignedPayload): string {
  const src = JSON.stringify(signed);
  let h = 2166136261;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(1_000_000_000 + (Math.abs(h) % 8_999_999_999));
}

export class MockExchange implements ExchangePort {
  readonly mode = "mock" as const;
  private readonly known = new Map<string, { status: string }>();
  private readonly approvedAgents = new Map<string, number>();

  async relaySignedAction(signed: SignedPayload): Promise<HLRelayResult> {
    const providerOrderId = mockOrderId(signed);
    this.known.set(providerOrderId, { status: "open" });
    return { providerOrderId, status: "open" };
  }

  /**
   * Simulated approveAgent. Mock mode never contacts the live provider, so no
   * real agent is approved and no funds are at risk (D-018.9).
   */
  async relayApproveAgent(params: {
    agentAddress: string;
    nonce: number;
    signature: Record<string, unknown>;
  }): Promise<{ ok: boolean; raw?: unknown }> {
    if (!/^0x[0-9a-f]{40}$/i.test(params.agentAddress)) {
      throw new ProviderError("Invalid agent address", "hyperliquid", false);
    }
    this.approvedAgents.set(params.agentAddress.toLowerCase(), params.nonce);
    return { ok: true, raw: { status: "ok", response: { type: "default" }, mock: true } };
  }

  async getOrderStatus(providerOrderId: string): Promise<HLOrderStatus | null> {
    const found = this.known.get(providerOrderId);
    if (!found) {
      return { status: "unknown", orderId: providerOrderId, oid: null, filled: false, avgPx: null, totalSz: null };
    }
    return {
      status: found.status,
      orderId: providerOrderId,
      oid: Number(providerOrderId),
      filled: false,
      avgPx: null,
      totalSz: null,
    };
  }
}

export class MockHyperliquid
  implements HyperliquidPort
{
  readonly mode = "mock" as const;
  private readonly market = new MockMarketData();
  private readonly account = new MockAccountData();
  private readonly exchange = new MockExchange();

  listAssets = () => this.market.listAssets();
  getMids = () => this.market.getMids();
  getOrderBook = (a: string) => this.market.getOrderBook(a);
  getSnapshot = (a: string) => this.market.getSnapshot(a);
  getAccountState = (a: string) => this.account.getAccountState(a);
  getOpenOrders = (a: string) => this.account.getOpenOrders(a);
  getFills = (a: string) => this.account.getFills(a);
  relaySignedAction = (s: SignedPayload) => this.exchange.relaySignedAction(s);
  relayApproveAgent = (p: {
    agentAddress: string;
    nonce: number;
    signature: Record<string, unknown>;
  }) => this.exchange.relayApproveAgent(p);
  getOrderStatus = (id: string) => this.exchange.getOrderStatus(id);
}

export class MockEthos implements EthosPort {
  readonly mode = "mock" as const;

  async getReputation(profileRef: string): Promise<EthosReputation> {
    const seed = [...profileRef].reduce((a, c) => a + c.charCodeAt(0), 0);
    return {
      providerProfileId: `ethos_mock_${seed % 9999}`,
      credibilityScore: 900 + (seed % 1800),
      reviewsCount: 3 + (seed % 40),
      vouchesCount: 1 + (seed % 25),
      humanVerified: seed % 3 === 0,
      sourceUrl: null,
      syncedAt: nowIso(),
    };
  }
}

export class MockX implements XPort {
  readonly mode = "mock" as const;

  async resolveIdentity(handle: string): Promise<XUser> {
    const clean = handle.replace(/^@/, "");
    return {
      xUserId: `x_mock_${clean.toLowerCase()}`,
      handle: clean,
      displayName: clean,
      avatarUrl: null,
    };
  }

  async createPost(accessToken: string, text: string): Promise<XPostResult> {
    const id = `mock_post_${text.length}_${Date.now().toString(36)}`;
    void accessToken;
    return { postId: id, text, url: null };
  }

  buildAuthorizationUrl(opts: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    scope: string;
  }): string {
    const p = new URLSearchParams({
      response_type: "code",
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      scope: opts.scope,
      state: opts.state,
      code_challenge: opts.codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${p.toString()}`;
  }
}