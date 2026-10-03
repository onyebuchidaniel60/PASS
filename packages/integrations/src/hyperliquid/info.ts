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

  async metaAndAssetCtxs(): Promise<{
    universe: Array<Record<string, unknown>>;
    ctxs: Array<Record<string, unknown>>;
  }> {
    return this.post({ type: "metaAndAssetCtxs" });
  }

  async listAssets(): Promise<HLAssetMeta[]> {
    const raw = await this.metaAndAssetCtxs();
    return (raw.universe ?? []).map((u, i) => {
      const ctx = raw.ctxs?.[0]?.[i] as Record<string, unknown> | undefined;
      const name = String(u.name ?? "");
      const szDecimals = u.szDecimals;
      const maxLeverage = ctx?.maxLeverage;
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