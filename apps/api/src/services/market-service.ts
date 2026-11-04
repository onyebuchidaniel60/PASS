import type { HLAssetMeta, MarketClass } from "@pass/contracts";
import type { AppContext } from "../context.js";
import { currentVenue, type Venue } from "./venue.js";

/**
 * One market configuration, read by both `/health` and `GET /api/v1/markets`.
 *
 * HIP-4 is additive. Mainnet keeps only the historical perp class until the
 * outcome venue is explicitly enabled there; the checkout never infers a class
 * from a coin string alone, so a `#N` Pass cannot quietly become executable on
 * a venue that does not list outcome markets.
 */
export interface MarketServiceConfig {
  venue: Venue;
  enabledMarketClasses: MarketClass[];
}

export function marketServiceConfig(ctx: AppContext): MarketServiceConfig {
  const venue = currentVenue(ctx);
  return {
    venue,
    enabledMarketClasses:
      venue === "mainnet" ? ["perp"] : ["perp", "hip4"],
  };
}

export interface MarketAssetDto extends HLAssetMeta {
  midPrice: string | null;
  /** Human label for selectors, e.g. "BTC-PERP" or "#200-HIP4 Yes". */
  label: string;
}

export interface Hip4Availability {
  available: boolean;
  reason: string | null;
  /** Venue-reported quote token when it differs from USDH (diagnostic). */
  reportedQuoteToken: string | null;
}

export interface MarketsResponse {
  mode: "live" | "mock";
  venue: Venue;
  enabledMarketClasses: MarketClass[];
  assets: MarketAssetDto[];
  hip4: Hip4Availability;
}

function labelFor(asset: HLAssetMeta): string {
  if (asset.marketClass === "hip4") {
    const side = asset.outcome?.side === "no" ? "No" : "Yes";
    return `${asset.asset} · ${side}${asset.outcome?.name ? ` · ${asset.outcome.name}` : ""}`;
  }
  return `${asset.asset}-${asset.dex.toUpperCase()}`;
}

function withPrice(asset: HLAssetMeta, mids: Record<string, string>): MarketAssetDto {
  return {
    ...asset,
    midPrice: mids[asset.asset] ?? null,
    label: labelFor(asset),
  };
}

/**
 * Perps plus the outcome markets the venue is actively quoting.
 *
 * A failing `outcomeMeta` is reported as unavailable, never collapsed into an
 * empty list: "no outcome markets" and "this venue cannot answer" are different
 * states, and only one of them means the selector is complete.
 */
export async function listMarkets(ctx: AppContext): Promise<MarketsResponse> {
  const config = marketServiceConfig(ctx);
  const [perps, mids] = await Promise.all([
    ctx.adapters.hyperliquid.listAssets(),
    ctx.adapters.hyperliquid.getMids(),
  ]);

  const assets: MarketAssetDto[] = perps
    .filter((a) => (a.marketClass ?? "perp") === "perp")
    .map((a) => withPrice({ ...a, marketClass: a.marketClass ?? "perp" }, mids));

  let hip4: Hip4Availability = {
    available: false,
    reason: "HIP-4 outcome markets are not enabled on this venue.",
    reportedQuoteToken: null,
  };

  if (config.enabledMarketClasses.includes("hip4")) {
    try {
      const outcomes = await ctx.adapters.hyperliquid.listOutcomeAssets(mids);
      for (const a of outcomes) assets.push(withPrice(a, mids));
      const reported = outcomes.find((a) => a.venueQuoteToken)?.venueQuoteToken ?? null;
      hip4 = {
        available: true,
        reason: null,
        reportedQuoteToken: reported,
      };
    } catch (err) {
      hip4 = {
        available: false,
        reason:
          "Outcome markets could not be loaded from this venue" +
          (err instanceof Error ? `: ${err.message.slice(0, 160)}` : "."),
        reportedQuoteToken: null,
      };
    }
  }

  return {
    mode: ctx.adapters.hyperliquid.mode,
    venue: config.venue,
    enabledMarketClasses: config.enabledMarketClasses,
    assets,
    hip4,
  };
}
