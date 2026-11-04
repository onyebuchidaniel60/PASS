import { describe, expect, it } from "vitest";

import { outcomeAssets, parseOutcomeMeta, reportedQuoteToken } from "./outcomes.js";

/**
 * `outcomeMeta` parsing. The public Info API docs do not describe this
 * endpoint (verified 2026-10-30); these fixtures are copied from the live
 * testnet response shape so a venue change is caught here rather than in the
 * market selector.
 */
describe("outcomeMeta parsing", () => {
  const liveEnvelope = {
    outcomes: [
      {
        outcome: 20,
        name: "Will BTC close above $120,000 on 2026-12-31?",
        description: "Resolves YES if the BTC mark is above $120,000 at expiry.",
        sideSpecs: [{ name: "Yes" }, { name: "No" }],
        quoteToken: "USDC",
        venue: "testnet",
        deployerFeeScale: "1.0",
      },
      {
        outcome: 7,
        question: "Will ETH flip $10,000?",
        sideSpecs: [{ name: "Yes" }, { name: "No" }],
        quoteToken: "USDH",
      },
    ],
    questions: [],
  };

  it("parses the live object envelope with live field names", () => {
    const parsed = parseOutcomeMeta(liveEnvelope);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      outcomeId: 20,
      name: "Will BTC close above $120,000 on 2026-12-31?",
      description: "Resolves YES if the BTC mark is above $120,000 at expiry.",
      quoteToken: "USDC",
      venue: "testnet",
      sideNames: ["Yes", "No"],
    });
    expect(parsed[1]?.name).toBe("Will ETH flip $10,000?");
  });

  it("parses the bare-array variant", () => {
    const parsed = parseOutcomeMeta([
      {
        outcome: "5",
        name: "Bare array outcome",
        sideSpecs: [{ name: "Yes" }, { name: "No" }],
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.outcomeId).toBe(5);
  });

  it("drops malformed rows instead of throwing", () => {
    const parsed = parseOutcomeMeta({
      outcomes: [
        { name: "no id" },
        { outcome: -1, name: "negative" },
        { outcome: 3.5, name: "fractional" },
        { outcome: 9, name: "valid" },
        null,
        "nope",
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.outcomeId).toBe(9);
    // No question/description: a display name is still required.
    expect(parsed[0]?.name).toBe("valid");
  });

  it("returns an empty list for an unknown envelope", () => {
    expect(parseOutcomeMeta(null)).toEqual([]);
    expect(parseOutcomeMeta({})).toEqual([]);
    expect(parseOutcomeMeta("outcomes")).toEqual([]);
  });
});

describe("outcome asset expansion", () => {
  const outcomes = parseOutcomeMeta({
    outcomes: [
      {
        outcome: 20,
        name: "Will BTC close above $120,000 on 2026-12-31?",
        description: "Resolves YES above $120k.",
        quoteToken: "USDC",
        sideSpecs: [{ name: "Yes" }, { name: "No" }],
      },
    ],
  });

  it("expands one outcome into YES and NO with documented encodings", () => {
    const assets = outcomeAssets(outcomes);
    expect(assets).toHaveLength(2);

    expect(assets[0]).toMatchObject({
      asset: "#200",
      dex: "hip4",
      marketClass: "hip4",
      assetId: 100_000_200,
      szDecimals: 2,
      maxLeverage: null,
      collateral: "USDH",
      balanceCoin: "+200",
      outcome: {
        outcomeId: 20,
        side: "yes",
        orderCoin: "#200",
        balanceCoin: "+200",
        assetId: 100_000_200,
      },
    });
    expect(assets[1]).toMatchObject({
      asset: "#201",
      assetId: 100_000_201,
      balanceCoin: "+201",
      outcome: { outcomeId: 20, side: "no" },
    });
  });

  it("surfaces a venue quote token that differs from USDH", () => {
    const assets = outcomeAssets(outcomes);
    expect(assets[0]?.venueQuoteToken).toBe("USDC");
  });

  it("does not warn when the venue reports USDH", () => {
    const usdh = parseOutcomeMeta({
      outcomes: [{ outcome: 1, name: "USDH collateral", quoteToken: "USDH" }],
    });
    expect(outcomeAssets(usdh)[0]?.venueQuoteToken).toBeNull();
  });

  it("filters to outcomes the venue is quoting (#N mids)", () => {
    const assets = outcomeAssets(outcomes, { "#201": "0.38", BTC: "113400" });
    expect(assets.map((a) => a.asset)).toEqual(["#201"]);
  });

  it("falls back to the full list when no outcome mids are published", () => {
    const assets = outcomeAssets(outcomes, { BTC: "113400" });
    expect(assets.map((a) => a.asset)).toEqual(["#200", "#201"]);
  });

  it("reports the venue quote token for diagnostics", () => {
    expect(reportedQuoteToken(outcomes)).toBe("USDC");
    expect(reportedQuoteToken([])).toBeNull();
  });
});
