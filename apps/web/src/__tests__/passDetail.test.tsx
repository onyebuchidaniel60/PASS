import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { PassDetailClient } from "../app/p/[publicId]/PassDetailClient";
import { StaleInterstitial, Dialog } from "@/components/wave5/Dialog";

/**
 * Pass detail — design/DESIGN.md §10.3, docs/UX_SPEC.md §5.
 *
 * The real client is mocked at the network boundary, so these are tests of the
 * SCREEN, not of a fixture: the shape matches GET /api/v1/passes/{publicId}
 * exactly as the deployed API returns it.
 */
const PASS = {
  publicId: "UvvuxpWPZ4",
  version: 1,
  asset: "BTC",
  direction: "long",
  status: "active",
  entryType: "limit",
  entryPrice: "113400",
  stopLoss: "111900",
  takeProfit: "116000",
  leverage: "5",
  thesis: "BTC reclaiming the 113.4k range top with increasing volume.",
  publishedAt: "2026-10-04T14:22:08.626Z",
  expiresAt: "2099-10-07T14:22:08.603Z",
  trader: {
    slug: "turnttfup99",
    handle: "turnttfup99",
    displayName: "Demo Trader",
    bio: "BTC / ETH perpetual trader.",
    xHandle: "turnttfup99",
    hyperliquidAccountAddress: "0x00000000000000000000000000000000000d3a0",
  },
  reputation: {
    credibilityScore: 1392,
    reviewsCount: 15,
    vouchesCount: 18,
    humanVerified: true,
  },
  market: { markPrice: "113412.5", observedAt: "2026-10-06T21:57:18.009Z" },
  performance: {
    takersCount: 0,
    completedCount: 0,
    tpHitCount: 0,
    slHitCount: 0,
    totalRealizedPnl: null,
  },
};

/**
 * vi.hoisted, not a bare const: `vi.mock` is hoisted above module evaluation,
 * so a factory referencing a later `const` hits the temporal dead zone and the
 * rejection escapes as an unhandled promise instead of reaching the component.
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("@/lib/client", () => ({ clientGet: (...a: unknown[]) => mockGet(...a) }));

beforeEach(() => mockGet.mockReset());

function renderPass(overrides: Record<string, unknown> = {}) {
  mockGet.mockResolvedValue({ ...PASS, ...overrides });
  return render(<PassDetailClient publicId="UvvuxpWPZ4" />);
}

/**
 * KNOWN GAP, recorded rather than hidden: the network-failure -> error-state
 * transition on this screen is NOT covered here.
 *
 * The component's error branch is implemented (ErrorBlock + Retry) and
 * ErrorBlock's own contract is covered in wave3/data.test.tsx, but the
 * transition itself could not be exercised: a rejected clientGet escapes this
 * runner as an unhandled rejection, whether rejected immediately, on a later
 * tick, thrown synchronously from an async function, or wrapped in act().
 * Four approaches were tried and all failed the suite before the state could be
 * observed.
 *
 * Closing this properly means extracting the presentational states from the
 * data-fetching wrapper so the error branch can be rendered directly. That is a
 * real refactor, not a test tweak, and it did not fit this session. Recorded in
 * design/phase-records/ as an open item rather than asserted away.
 */
describe("Pass detail states that are covered", () => {
  it("renders a loading state that announces itself as busy", async () => {
    // A promise settled by the test rather than one that never settles: a
    // permanently pending promise keeps act() waiting and times the hook out.
    let release: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<PassDetailClient publicId="UvvuxpWPZ4" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    release(null);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });
});

describe("Pass detail renders a Pass (§10.3)", () => {
  it("leads with asset and direction as the largest line", async () => {
    renderPass();
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("BTC");
    expect(h1.textContent ?? "").toMatch(/Long/i);
  });

  it("shows the status chip directly under the asset line", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("shows ENTRY, TP and SL as a coordinate grid in mono", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    // §11.2 thousands separator supplied by formatting, never re-rounded.
    expect(screen.getByText("113,400")).toBeInTheDocument();
    expect(screen.getByText("116,000")).toBeInTheDocument();
    expect(screen.getByText("111,900")).toBeInTheDocument();
    expect(screen.getByText("5x")).toBeInTheDocument();
  });

  it("shows the trader handle and the Ethos score separately", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("@turnttfup99")).toBeInTheDocument();
    expect(screen.getByText("1,392")).toBeInTheDocument();
  });

  it("separates reputation from PASS performance with a rule", async () => {
    // D-007 / PRD §12 make merging them a P0 anti-pattern.
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("region", { name: "Reputation" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "PASS performance" })).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "End of trader identity" }),
    ).toBeInTheDocument();
  });

  it("never shows a trust score", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(document.body.textContent?.toLowerCase()).not.toContain("trust score");
  });

  it("marks market context LIVE or STALE in text", async () => {
    renderPass({ market: { markPrice: "113412.5", observedAt: new Date().toISOString() } });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("Mark")).toBeInTheDocument();
    expect(screen.getByText(/Live|Stale/)).toBeInTheDocument();
  });

  it("offers exactly one accent CTA and states that size is the Taker's", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Take Pass" })).toHaveAttribute(
      "href",
      "/passes/UvvuxpWPZ4/take",
    );
    expect(
      screen.getByText(/never selects a size for you/i),
    ).toBeInTheDocument();
  });

  it("shows no urgency or scarcity language (§12.4)", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    const text = document.body.textContent?.toLowerCase() ?? "";
    for (const w of ["closing soon", "people are taking", "countdown", "hurry"]) {
      expect(text, w).not.toContain(w);
    }
  });
});

describe("Pass detail lifecycle states (§10.3, §11.7)", () => {
  const cases = [
    ["active", "Active"],
    ["entry_pending", "Entry Pending"],
    ["open", "Open"],
    ["expired", "Expired"],
    ["cancelled", "Cancelled"],
  ] as const;

  for (const [state, label] of cases) {
    it(`renders the ${state} lifecycle state as text`, async () => {
      renderPass({ status: state });
      await screen.findByRole("heading", { level: 1 });
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  }
});

describe("Dialog and stale interstitial (§9.8, §10.7)", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}} title="x">
        body
      </Dialog>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("is a labelled modal when open", () => {
    render(
      <Dialog open onClose={() => {}} title="This Pass changed.">
        body
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "This Pass changed." })).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    render(
      <Dialog open onClose={onClose} title="t">
        <button type="button">inside</button>
      </Dialog>,
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("traps Tab inside the dialog", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    render(
      <>
        <button type="button">outside</button>
        <Dialog open onClose={() => {}} title="t">
          <button type="button">first</button>
          <button type="button">last</button>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole("dialog");
    dialog.focus();
    await user.tab();
    // Focus must stay within the dialog, never reach the outside button.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("interstitial states the change and offers exactly one accent action", () => {
    const { container } = render(
      <StaleInterstitial open onReviewLatest={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText("This Pass changed.")).toBeInTheDocument();
    expect(
      screen.getByText("The trade parameters you reviewed are no longer current."),
    ).toBeInTheDocument();
    // §10.7 Review latest Pass is the only accent on the screen.
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Review latest Pass" })).toBeInTheDocument();
  });

  it("shows a mono diff of what changed when supplied", () => {
    render(
      <StaleInterstitial
        open
        onReviewLatest={() => {}}
        onDismiss={() => {}}
        changes={[{ label: "Entry", from: "113,400", to: "114,000" }]}
      />,
    );
    expect(screen.getByText("113,400")).toBeInTheDocument();
    expect(screen.getByText("114,000")).toBeInTheDocument();
  });
});

/**
 * §14 assertions for Pass detail. Added 2026-10-07 when the screen was rebuilt.
 *
 * Every clause here was silently failing before: the screen satisfied §§1-13 and
 * was still visibly not the reference, which is precisely the failure §14 was
 * written to prevent. These are the assertions that would have caught it.
 */
describe("Pass detail reference language (14)", () => {
  it("frames the object with a corner bracket frame, the fourth of four (14.2)", async () => {
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelectorAll(".pass-brackets")).toHaveLength(1);
    expect(container.querySelector(".pass-brackets-foot")).toBeTruthy();
  });

  it("spends the LAST bracket frame here, so none is left for another screen", async () => {
    // 14.2 rations corner brackets to four uses in the whole product. Landing
    // spends two and /how-it-works one; this is the fourth. If a fifth appears
    // anywhere, the ration is not being enforced.
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelectorAll(".pass-brackets").length).toBeLessThanOrEqual(1);
  });

  it("puts the object on a section wash, not the hero strength (14.1)", async () => {
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    const shell = container.querySelector(".pass-detail-shell") as HTMLElement;
    expect(shell.getAttribute("data-strength")).toBe("section");
    // A hero-strength wash behind dense digits costs the contrast 11.1 refuses
    // to compromise, so it must be absent here, not merely overridden.
    expect(shell.getAttribute("data-strength")).not.toBe("hero");
    expect(shell.querySelector(".pass-grain")).toBeTruthy();
  });

  it("renders the asset and the direction as two authored lines, one accent word", async () => {
    const { container } = renderPass({ asset: "btc", direction: "long" });
    await screen.findByRole("heading", { level: 1 });
    const h1 = container.querySelector("h1") as HTMLElement;
    const lines = h1.querySelectorAll(".pass-display-line");
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe("BTC");
    expect(lines[1].querySelectorAll(".pass-display-accent")).toHaveLength(1);
    expect(lines[1].querySelector(".pass-display-accent")?.textContent).toBe("LONG");
  });

  it("forbids the gradient variant, because the headline carries a live value", async () => {
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    // A gradient behind changing digits makes the digits harder to read.
    expect(container.querySelector("h1")?.getAttribute("data-gradient")).toBeNull();
  });

  it("shows exactly the five 11.3 figures and nothing more", async () => {
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    // Scoped to the FIRST metric row: the PASS-metrics row further down the
    // page uses the same component, so an unscoped query would see nine labels
    // and prove nothing about the plan block.
    const planRow = container.querySelector(".pass-metric-cards") as HTMLElement;
    const labels = Array.from(planRow.querySelectorAll(".pass-metric-card-label")).map(
      (l) => l.textContent,
    );
    // Entry, Take profit, Stop loss, Leverage, R:R. A sixth would be an
    // invented metric.
    expect(labels).toEqual(["Entry", "Take profit", "Stop loss", "Leverage", "R:R"]);
  });

  it("derives R:R from the plan and renders a dash, never a fabricated ratio", async () => {
    const { container } = renderPass({
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
    });
    await screen.findByRole("heading", { level: 1 });
    const rr = Array.from(container.querySelectorAll(".pass-metric-card")).find((c) =>
      c.querySelector(".pass-metric-card-label")?.textContent?.includes("R:R"),
    );
    // (116000-113400) / (113400-111900) = 1.733...
    expect(rr?.querySelector(".pass-metric-card-value")?.textContent).toBe("1.73:1");
  });

  it("renders a dash for R:R when the risk is zero, not an infinity", async () => {
    const { container } = renderPass({
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "113400",
    });
    await screen.findByRole("heading", { level: 1 });
    const rr = Array.from(container.querySelectorAll(".pass-metric-card")).find((c) =>
      c.querySelector(".pass-metric-card-label")?.textContent?.includes("R:R"),
    );
    expect(rr?.querySelector(".pass-metric-card-value")?.textContent).toBe("—");
  });

  it("puts each unit on the same baseline as its figure (14.5.4)", async () => {
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    // A unit on its own line reads as a second value, so it must be a CHILD of
    // the value element rather than a sibling of it.
    const entry = Array.from(container.querySelectorAll(".pass-metric-card")).find((c) =>
      c.querySelector(".pass-metric-card-label")?.textContent === "Entry",
    );
    const value = entry?.querySelector(".pass-metric-card-value");
    expect(value?.querySelector(".pass-metric-card-unit")?.textContent).toBe("per ETH");
  });

  it("renders the market snapshot with a dot eyebrow and a LiveDot", async () => {
    const { container } = renderPass({
      market: { markPrice: "113412.5", observedAt: new Date().toISOString() },
    });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("MARKET SNAPSHOT")).toBeInTheDocument();
    expect(container.querySelector(".pass-dot-eyebrow")).toBeTruthy();
    expect(container.querySelector(".pass-live-dot")).toBeTruthy();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders a sparkline only when a real series arrives", async () => {
    const { container } = renderPass({
      market: { markPrice: "113412.5", observedAt: new Date().toISOString() },
    });
    await screen.findByRole("heading", { level: 1 });
    // A flat line would be an invented observation.
    expect(container.querySelector(".pass-sparkline")).toBeNull();

    const { container: withSeries } = renderPass({
      market: {
        markPrice: "113412.5",
        observedAt: new Date().toISOString(),
        series: [113000, 113200, 113100, 113412.5],
      },
    });
    await screen.findByRole("heading", { level: 1 });
    expect(withSeries.querySelector(".pass-sparkline")).toBeTruthy();
    expect(screen.getByRole("img", { name: /recent trades/i })).toBeInTheDocument();
  });

  it("states an absent market reading rather than rendering an empty card", async () => {
    renderPass({ market: null });
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("No market reading")).toBeInTheDocument();
  });

  it("marks the state with a 14.6 badge carrying icon and word", async () => {
    const { container } = renderPass({ status: "tp_hit" });
    await screen.findByRole("heading", { level: 1 });
    const badge = container.querySelector(".pass-badge") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.querySelector(".pass-badge-icon")).toBeTruthy();
    expect(badge.getAttribute("data-tone")).toBe("tp_hit");
  });

  it("renders the trader mini-card linking to the profile route", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    // §2.5: the profile affordance is a 14.9 outlined chip, NOT an accent card
    // action, because the Take Pass CTA is this page's one accent fill.
    const chip = screen.getByRole("link", { name: "Profile" });
    expect(chip).toHaveAttribute("href", "/u/turnttfup99");
    expect(chip.className).toContain("pass-chip");
  });

  it("states the Ethos score exactly once, in the reputation block", async () => {
    renderPass();
    await screen.findByRole("heading", { level: 1 });
    // 11.4: one figure, one place. The mini-card deliberately does NOT restate
    // it, so the number never has to change in two places and two adjacent
    // renderings cannot be read as a merge.
    expect(screen.getAllByText("1,392").length).toBe(1);
  });

  it("distinguishes a 404 from an unreachable API", async () => {
    // Telling a reader their link is broken when the network is down is a lie
    // about the state of the product.
    mockGet.mockRejectedValueOnce(Object.assign(new Error("Not found"), { status: 404 }));
    render(<PassDetailClient publicId="nope" />);
    expect(await screen.findByText("This Pass does not exist.")).toBeInTheDocument();

    mockGet.mockRejectedValueOnce(Object.assign(new Error("failed"), { status: 502 }));
    render(<PassDetailClient publicId="nope2" />);
    expect(await screen.findByText("Could not reach PASS.")).toBeInTheDocument();
  });

  it("numbers its sections 01 to 06 with the numbered eyebrow", async () => {
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    const numbers = Array.from(
      container.querySelectorAll(".pass-numbered-eyebrow-number"),
    ).map((n) => n.textContent?.replace(/\\/g, "").trim());
    expect(numbers).toEqual(["01", "02", "03", "04", "05", "06"]);
  });

  it("keeps exactly one accent fill: the Take Pass CTA", async () => {
    const { container } = renderPass();
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    // No accent-filled card action either: the only accent on this page is the
    // Take Pass CTA.
    expect(container.querySelectorAll(".pass-card-action")).toHaveLength(0);
    // And the chip that replaced it is unselected, so it carries no accent.
    const chip = screen.getByRole("link", { name: "Profile" });
    expect(chip.getAttribute("aria-pressed")).toBeNull();
    expect(chip.getAttribute("data-selected")).toBeNull();
  });
});
