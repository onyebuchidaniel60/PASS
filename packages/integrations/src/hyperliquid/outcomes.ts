import type { HLAssetMeta, HLOutcomeMeta } from "@pass/contracts";
import {
  HIP4_ASSET_ID_OFFSET,
  HIP4_COLLATERAL,
  HIP4_DEFAULT_SZ_DECIMALS,
  encodeOutcome,
} from "@pass/domain";

/**
 * Pure `outcomeMeta` parsing and asset expansion.
 *
 * The public Info API docs do not describe `outcomeMeta` (verified
 * 2026-10-30), but the live demo/testnet endpoints accept
 * `POST /info {"type":"outcomeMeta"}` and answer with an object:
 *
 *   { outcomes: [ { outcome, name, description, sideSpecs: [{name}, {name}],
 *                   quoteToken, venue?, deployerFeeScale? } ], questions, ... }
 *
 * The task description also specifies a bare-array variant. Both are
 * accepted here so a venue change is a non-event rather than an outage.
 *
 * Network-free by design: the Info client fetches, this module interprets.
 */

interface RawOutcome {
  outcome?: unknown;
  id?: unknown;
  name?: unknown;
  question?: unknown;
  description?: unknown;
  sideSpecs?: unknown;
  sides?: unknown;
  quoteToken?: unknown;
  venue?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function outcomeList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (!obj) return [];
  if (Array.isArray(obj.outcomes)) return obj.outcomes;
  // Defensive: some venue builds may nest the list.
  if (Array.isArray(obj.data)) return obj.data;
  return [];
}

function toOutcomeId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return null;
}

function sideNames(value: unknown): [string, string] | null {
  if (!Array.isArray(value)) return null;
  const names = value
    .map((s) => {
      if (typeof s === "string") return s;
      const rec = asRecord(s);
      return rec && typeof rec.name === "string" ? rec.name : null;
    })
    .filter((s): s is string => Boolean(s));
  if (names.length < 2) return null;
  return [names[0]!, names[1]!];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Parse either the live object envelope or the documented bare array. */
export function parseOutcomeMeta(raw: unknown): HLOutcomeMeta[] {
  const out: HLOutcomeMeta[] = [];
  for (const item of outcomeList(raw)) {
    const rec = asRecord(item) as RawOutcome | null;
    if (!rec) continue;
    const outcomeId = toOutcomeId(rec.outcome ?? rec.id);
    if (outcomeId === null) continue;
    const name = str(rec.name) ?? str(rec.question) ?? str(rec.description) ?? `Outcome ${outcomeId}`;
    out.push({
      outcomeId,
      name,
      description: str(rec.description),
      quoteToken: str(rec.quoteToken),
      venue: str(rec.venue),
      sideNames: sideNames(rec.sideSpecs ?? rec.sides),
    });
  }
  return out;
}

/**
 * Expand outcomes into the two tradable assets each one defines.
 *
 * `mids` filters the list to markets the venue is actually quoting (`#N`
 * keys in `allMids`). When no outcome mids are published the full list is
 * returned rather than an empty selector: absence of quotes must not look
 * like absence of markets.
 */
export function outcomeAssets(
  outcomes: readonly HLOutcomeMeta[],
  mids?: Record<string, string> | null,
): HLAssetMeta[] {
  const quoted = mids
    ? new Set(Object.keys(mids).filter((key) => key.startsWith("#")))
    : null;
  const filterByQuotes = quoted !== null && quoted.size > 0;
  const assets: HLAssetMeta[] = [];

  for (const outcome of outcomes) {
    for (const side of [0, 1] as const) {
      const encoded = encodeOutcome(outcome.outcomeId, side);
      if (!encoded) continue;
      if (filterByQuotes && !quoted.has(encoded.orderCoin)) continue;
      assets.push({
        asset: encoded.orderCoin,
        dex: "hip4",
        marketClass: "hip4",
        assetId: HIP4_ASSET_ID_OFFSET + encoded.encoding,
        szDecimals: HIP4_DEFAULT_SZ_DECIMALS,
        maxLeverage: null,
        collateral: HIP4_COLLATERAL,
        balanceCoin: encoded.balanceCoin,
        venueQuoteToken:
          outcome.quoteToken && outcome.quoteToken.toUpperCase() !== HIP4_COLLATERAL
            ? outcome.quoteToken
            : null,
        outcome: {
          outcomeId: outcome.outcomeId,
          side: encoded.sideName,
          name: outcome.name,
          description: outcome.description,
          orderCoin: encoded.orderCoin,
          balanceCoin: encoded.balanceCoin,
          assetId: HIP4_ASSET_ID_OFFSET + encoded.encoding,
        },
      });
    }
  }
  return assets.sort((a, b) =>
    a.assetId === b.assetId ? a.asset.localeCompare(b.asset) : a.assetId - b.assetId,
  );
}

/** First venue quote token reported across outcomes, for diagnostics. */
export function reportedQuoteToken(outcomes: readonly HLOutcomeMeta[]): string | null {
  for (const o of outcomes) if (o.quoteToken) return o.quoteToken;
  return null;
}
