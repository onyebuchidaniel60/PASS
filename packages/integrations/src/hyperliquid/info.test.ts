import { describe, expect, it, vi } from "vitest";

import { HyperliquidInfoClient } from "./info.js";

/**
 * `metaAndAssetCtxs` response handling.
 *
 * The Info API returns a two-element TUPLE — `[meta, assetCtxs]` — not an object
 * with `universe`/`ctxs` keys. This client typed the raw response as an object,
 * so `raw.universe` was `undefined`, the `?? []` fallback quietly produced an
 * empty list, and `GET /api/v1/markets` returned `{"assets":[]}` with HTTP 200
 * on a live deployment. Found 2026-10-07 by calling the live API.
 *
 * The failure was silent and status-200, which is why it survived every
 * typecheck, lint and unit test.
 */
const INFO = "https://api.hyperliquid.xyz/info";

/** Shape captured from the live API on 2026-10-07. */
const TUPLE = [
  {
    universe: [
      { szDecimals: 5, name: "BTC", maxLeverage: 40, marginTableId: 56 },
      { szDecimals: 4, name: "ETH", maxLeverage: 40, marginTableId: 56 },
    ],
    marginTables: [{ id: 56 }],
    collateralToken: { name: "USDC" },
  },
  [
    { coin: "BTC", markPx: "83158.0", midPx: "83158.5", funding: "0.0000125" },
    { coin: "ETH", markPx: "2566.0", midPx: "2566.55", funding: "0.0000090" },
  ],
];

function stubJson(body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("HyperliquidInfoClient.metaAndAssetCtxs", () => {
  it("unwraps the two-element tuple", async () => {
    stubJson(TUPLE);
    const { universe, ctxs } = await new HyperliquidInfoClient(INFO).metaAndAssetCtxs();
    expect(universe).toHaveLength(2);
    expect(ctxs).toHaveLength(2);
  });

  it("still tolerates an object-shaped response", async () => {
    // If the API ever reverts, this must be a non-event rather than an outage.
    const meta = TUPLE[0] as { universe: unknown[] };
    stubJson({ universe: meta.universe, ctxs: TUPLE[1] });
    const { universe, ctxs } = await new HyperliquidInfoClient(INFO).metaAndAssetCtxs();
    expect(universe).toHaveLength(2);
    expect(ctxs).toHaveLength(2);
  });

  it("returns empty arrays rather than throwing on an unexpected shape", async () => {
    stubJson("nope");
    const { universe, ctxs } = await new HyperliquidInfoClient(INFO).metaAndAssetCtxs();
    expect(universe).toEqual([]);
    expect(ctxs).toEqual([]);
  });
});

describe("HyperliquidInfoClient.listAssets", () => {
  it("returns every asset, which is the assertion that was silently failing", async () => {
    stubJson(TUPLE);
    const assets = await new HyperliquidInfoClient(INFO).listAssets();
    // Before the fix this was [] because raw.universe was undefined.
    expect(assets).toHaveLength(2);
  });

  it("reads maxLeverage from the universe entry", async () => {
    // Since 2026-10 the universe entry carries maxLeverage; the ctx array does
    // not. Reading only from ctxs would drop leverage for every asset.
    stubJson(TUPLE);
    const assets = await new HyperliquidInfoClient(INFO).listAssets();
    expect(assets[0]).toMatchObject({
      asset: "BTC",
      dex: "perp",
      assetId: 0,
      szDecimals: 5,
      maxLeverage: 40,
    });
  });

  it("falls back to a positionally-matched ctx for maxLeverage", async () => {
    stubJson([
      { universe: [{ szDecimals: 2, name: "BTC" }] },
      [{ coin: "BTC", maxLeverage: 25 }],
    ]);
    const assets = await new HyperliquidInfoClient(INFO).listAssets();
    expect(assets[0]?.maxLeverage).toBe(25);
  });

  it("omits maxLeverage rather than emitting NaN", async () => {
    stubJson([{ universe: [{ name: "BTC", szDecimals: 2 }] }, [{}]]);
    const assets = await new HyperliquidInfoClient(INFO).listAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0]).not.toHaveProperty("maxLeverage");
  });
});