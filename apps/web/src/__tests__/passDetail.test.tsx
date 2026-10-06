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
