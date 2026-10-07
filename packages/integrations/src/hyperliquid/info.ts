import type {
  HLAccountState,
  HLAssetMeta,
  HLFill,
  HLOrder,
  HLOpenOrder,
  HLOrderBook,
  HLOrderStatus,
} from "@pass/contracts";
import { toDecimalString } from "@pass/domain";
import { ProviderError, ProviderUnavailableError } from "../ports.js";

/**
 * Hyperliquid Info API client.
 * Reference: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
 *
 * Every account-scoped read takes accountAddress, which callers must supply
 * from trading_accounts.account_address. The agent address is a signer and is
 * never a valid query subject (docs/DECISIONS.md D-018.3).
 */
export class HyperliquidInfoClient {
  constructor(private readonly infoUrl: string) {}

  private async post<T>(body: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.infoUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ProviderUnavailableError("hyperliquid", String(err));
    }
    if (res.status === 429) {
      throw new ProviderError("Hyperliquid rate limited the request", "hyperliquid", true);
    }
    if (!res.ok) {
      throw new ProviderError(
        `Hyperliquid Info API ${res.status}`,
        "hyperliquid",
        res.status >= 500,
      );
    }
    return (await res.json()) as T;
  }

  /**
   * Reads `metaAndAssetCtxs` and returns it NORMALISED to `{universe, ctxs}`.
   *
   * The Info API returns a two-element TUPLE — `[meta, assetCtxs]` — not an
   * object with `universe`/`ctxs` keys. This method previously returned the raw
   * response and typed it as an object, so `raw.universe` was `undefined`, the
   * `?? []` fallback silently produced an empty list, and `GET /api/v1/markets`
   * returned `{"assets":[]}` with HTTP 200 on a live deployment. Verified
   * against the live API 2026-10-07:
   *
   *   [ { universe: [...], marginTables: [...], collateralToken },
   *     [ {funding, openInterest, prevDayPx, dayNtlVlm, oraclePx, markPx,
   *        midPx, impactPxs, ...}, ... ] ]
   *
   * Normalising here keeps the shape every caller already expects, so this is a
   * fix rather than an API change.
   */
  async metaAndAssetCtxs(): Promise<{
    universe: Array<Record<string, unknown>>;
    ctxs: Array<Record<string, unknown>>;
  }> {
    const raw = await this.post<unknown>({ type: "metaAndAssetCtxs" });
    if (Array.isArray(raw)) {
      const meta = (raw[0] ?? {}) as Record<string, unknown>;
      return {
        universe: Array.isArray(meta.universe)
          ? (meta.universe as Array<Record<string, unknown>>)
          : [],
        ctxs: Array.isArray(raw[1])
          ? (raw[1] as Array<Record<string, unknown>>)
          : [],
      };
    }
    // Tolerate the object shape in case the API reverts to it, so a future
    // change is a non-event rather than an outage.
    const obj = (raw ?? {}) as Record<string, unknown>;
    const nestedCtxs = obj.ctxs;
    return {
      universe: Array.isArray(obj.universe)
        ? (obj.universe as Array<Record<string, unknown>>)
        : [],
      ctxs: Array.isArray(nestedCtxs)
        ? (nestedCtxs as Array<Record<string, unknown>>)
        : Array.isArray((nestedCtxs as Array<unknown> | undefined)?.[0])
          ? ((nestedCtxs as Array<unknown>)[0] as Array<Record<string, unknown>>)
          : [],
    };
  }

  async listAssets(): Promise<HLAssetMeta[]> {
    const raw = await this.metaAndAssetCtxs();
    return raw.universe.map((u, i) => {
      // Ctxs are positionally aligned with the universe, and since 2026-10 the
      // universe entry ALSO carries `maxLeverage`. Read from both, universe
      // first, so leverage survives even if the ctx array is short.
      const ctx = raw.ctxs[i] ?? raw.ctxs.find((c) => c?.coin === u.name);
      const name = String(u.name ?? "");
      const szDecimals = u.szDecimals;
      const maxLeverage = u.maxLeverage ?? ctx?.maxLeverage;
      return {
        asset: name,
        dex: "perp",
        assetId: Number(u.index ?? i),
        ...(szDecimals === undefined ? {} : { szDecimals: Number(szDecimals) }),
        ...(maxLeverage === undefined
          ? {}
          : { maxLeverage: Number(maxLeverage) }),
      } satisfies HLAssetMeta;
    });
  }

  async allMids(): Promise<Record<string, string>> {
    const raw = await this.post<Record<string, string>>({ type: "allMids" });
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) out[k] = toDecimalString(v);
    return out;
  }

  async l2Book(asset: string): Promise<HLOrderBook | null> {
    const raw = await this.post<{ levels?: unknown[][]; coin?: string }>({
      type: "l2Book",
      coin: asset,
    });
    if (!raw?.levels) return null;
    const bids = (raw.levels[0] ?? []) as Array<{ px: string; sz: string }>;
    const asks = (raw.levels[1] ?? []) as Array<{ px: string; sz: string }>;
    return {
      asset,
      observedAt: new Date().toISOString(),
      levels: [
        ...bids.map((l) => ({ price: toDecimalString(l.px), size: toDecimalString(l.sz) })),
        ...asks.map((l) => ({ price: toDecimalString(l.px), size: toDecimalString(l.sz) })),
      ],
    };
  }

  async clearinghouseState(user: string): Promise<HLAccountState | null> {
    const raw = await this.post<Record<string, unknown>>({
      type: "clearinghouseState",
      user,
    });
    if (!raw) return null;
    const marginSummary =
      (raw.marginSummary as Record<string, unknown> | undefined) ?? {};
    return {
      accountAddress: user,
      accountValue:
        marginSummary.accountValue === undefined
          ? null
          : toDecimalString(String(marginSummary.accountValue)),
      withdrawable:
        marginSummary.withdrawable === undefined
          ? null
          : toDecimalString(String(marginSummary.withdrawable)),
      marginUsed: null,
      observedAt: new Date().toISOString(),
    };
  }

  async openOrders(user: string): Promise<HLOpenOrder> {
    const raw = await this.post<Array<Record<string, unknown>>>({
      type: "frontendOpenOrders",
      user,
    });
    const orders: HLOrder[] = (raw ?? []).map((o) => ({
      oid: Number(o.oid ?? 0),
      coin: String(o.coin ?? ""),
      side: String(o.side ?? "buy") === "sell" ? "sell" : "buy",
      limitPx: toDecimalString(String(o.limitPx ?? "0")),
      sz: toDecimalString(String(o.sz ?? "0")),
      reduceOnly: Boolean(o.reduceOnly),
      orderType: typeof o.orderType === "string" ? o.orderType : null,
    }));
    return { accountAddress: user, orders, observedAt: new Date().toISOString() };
  }

  async userFills(user: string): Promise<HLFill[]> {
    const raw = await this.post<Array<Record<string, unknown>>>({
      type: "userFills",
      user,
    });
    return (raw ?? []).map((f) => ({
      accountAddress: user,
      coin: String(f.coin ?? ""),
      side: String(f.side ?? "buy") === "sell" ? "sell" : "buy",
      px: toDecimalString(String(f.px ?? "0")),
      sz: toDecimalString(String(f.sz ?? "0")),
      time: Number(f.time ?? 0),
      oid: f.oid === undefined ? null : Number(f.oid),
      closedPnl: f.closedPnl === undefined || f.closedPnl === null ? null : toDecimalString(String(f.closedPnl)),
      fee: f.fee === undefined || f.fee === null ? null : toDecimalString(String(f.fee)),
      dir: typeof f.dir === "string" ? f.dir : null,
    }));
  }

  async orderStatusByOid(oid: number): Promise<HLOrderStatus | null> {
    const raw = await this.post<Record<string, unknown>>({
      type: "orderStatusByOid",
      oid,
    });
    if (!raw) return null;
    const status = String(
      (raw.status as Record<string, unknown> | undefined)?.Filled ??
        (raw.status as string | undefined) ??
        "unknown",
    );
    return {
      status: status === "[object Object]" ? "unknown" : status,
      orderId: String(oid),
      oid,
      filled: status === "filled",
      avgPx:
        raw.avgPx === undefined || raw.avgPx === null
          ? null
          : toDecimalString(String(raw.avgPx)),
      totalSz:
        raw.totalSz === undefined || raw.totalSz === null
          ? null
          : toDecimalString(String(raw.totalSz)),
    };
  }
}