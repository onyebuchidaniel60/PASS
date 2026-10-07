import { generateMetadata } from "../app/p/[publicId]/page";

/**
 * §10.14 Open Graph metadata for a shared Pass URL.
 *
 * The assertions that matter are the ones about what must NOT appear: a shared
 * link is public, so no private account data may reach it (§10.14, UX_SPEC §14).
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
// generateMetadata runs on the SERVER, so it uses the server client. Mocking
// "@/lib/client" here would have tested nothing: that helper is never called.
vi.mock("@/lib/api", () => ({ apiGet: (...a: unknown[]) => mockGet(...a) }));

const PASS = {
  asset: "BTC",
  direction: "long",
  entryPrice: "113400",
  takeProfit: "116000",
  stopLoss: "111900",
  trader: { xHandle: "turnttfup99", handle: "turnttfup99" },
};

async function meta(overrides: Record<string, unknown> = {}) {
  mockGet.mockResolvedValue({ ...PASS, ...overrides });
  return generateMetadata({ params: Promise.resolve({ publicId: "UvvuxpWPZ4" }) });
}

describe("Pass Open Graph metadata (§10.14)", () => {
  it("names the product, asset and direction in the title", async () => {
    const m = await meta();
    expect(m.title).toBe("PASS — BTC LONG");
    expect(m.openGraph?.title).toBe("PASS — BTC LONG");
  });

  it("renders SHORT for a short Pass", async () => {
    const m = await meta({ direction: "short" });
    expect(m.title).toBe("PASS — BTC SHORT");
  });

  it("formats the card line in the spec's shape with compact figures", async () => {
    const m = await meta();
    // §10.14: PASS / BTC LONG / @TraderX / Entry $113.4K • TP $116K • SL $111.9K
    expect(m.openGraph?.description).toBe(
      "BTC LONG · @turnttfup99 · Entry $113.4K • TP $116K • SL $111.9K",
    );
  });

  it("compacts figures, which is permitted here and ONLY here (§10.14)", async () => {
    const m = await meta({ entryPrice: "113400" });
    expect(m.openGraph?.description).toContain("$113.4K");
    expect(m.openGraph?.description).not.toContain("113,400.00");
  });

  it("never exposes private account data", async () => {
    const m = await meta({
      trader: {
        xHandle: "turnttfup99",
        handle: "turnttfup99",
        // Fields a real response carries and a share card must not.
        hyperliquidAccountAddress: "0x00000000000000000000000000000000000d3a0",
        userId: "6514eaea-52ca-444a-bcee-73b0fda71dc4",
      },
    });
    const blob = JSON.stringify(m);
    expect(blob).not.toContain("0x00000000000000000000000000000000000d3a0");
    expect(blob).not.toContain("6514eaea-52ca-444a-bcee-73b0fda71dc4");
  });

  it("supplies both Open Graph and Twitter card metadata", async () => {
    const m = await meta();
    expect(m.openGraph?.siteName).toBe("PASS");
    expect((m.twitter as Record<string, unknown> | undefined)?.card).toBe("summary");
    expect(m.twitter?.title).toBe(m.openGraph?.title);
  });

  it("still returns usable metadata when the Pass cannot be read", async () => {
    mockGet.mockRejectedValue(new Error("404"));
    const m = await generateMetadata({
      params: Promise.resolve({ publicId: "missing" }),
    });
    // The card names the Pass and asserts nothing false about it.
    expect(m.title).toContain("missing");
  });
});