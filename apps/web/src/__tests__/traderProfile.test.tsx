import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TraderProfileClient } from "../app/u/[slug]/TraderProfileClient";

/**
 * Trader profile — design/DESIGN.md §10.4, docs/UX_SPEC.md §6.
 *
 * The test that matters here is the separation one: performance and reputation
 * are different data categories, and D-007 / PRD §12 make merging them a P0
 * anti-pattern. A visual regression that combined them would still render, so
 * the assertion is structural.
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("@/lib/client", () => ({ clientGet: (...a: unknown[]) => mockGet(...a) }));

const PROFILE = {
  slug: "turnttfup99",
  handle: "turnttfup99",
  displayName: "Demo Trader",
  bio: "BTC / ETH perpetual trader.",
  xHandle: "turnttfup99",
  hyperliquidAccountAddress: "0x00000000000000000000000000000000000d3a0",
  connections: [
    { provider: "x", connected: true, label: "X connected" },
    { provider: "ethos", connected: true, label: "Ethos reputation resolved" },
  ],
  publishedPassCount: 1,
  completedPassCount: 0,
  activePassCount: 1,
  reputation: {
    credibilityScore: 1392,
    reviewsCount: 15,
    vouchesCount: 18,
    humanVerified: true,
  },
};

beforeEach(() => mockGet.mockReset());

async function renderProfile(passes: unknown[] = [], profile: unknown = PROFILE) {
  mockGet.mockImplementation((url?: unknown) =>
    Promise.resolve(
      typeof url === "string" && url.includes("/passes") ? { passes } : profile,
    ),
  );
  // The async act boundary is required: the screen resolves its data in an
  // effect, and without it every state update lands outside act and the
  // assertions observe the loading branch instead of the rendered profile.
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(<TraderProfileClient slug="turnttfup99" />);
  });
  return result;
}

describe("Trader profile identity (§10.4 item 1)", () => {
  it("renders the display name as the screen title", async () => {
    await renderProfile();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Demo Trader",
      ),
    );
  });

  it("renders the handle with an @ prefix", async () => {
    await renderProfile();
    await waitFor(() =>
      expect(screen.getByText("@turnttfup99")).toBeInTheDocument(),
    );
  });

  it("attributes connection state to the named provider, never synthesised", async () => {
    await renderProfile();
    await waitFor(() =>
      expect(screen.getByText("X connected")).toBeInTheDocument(),
    );
    expect(screen.getByText("Ethos reputation resolved")).toBeInTheDocument();
  });
});

describe("Performance and reputation stay separate (D-007, PRD §12)", () => {
  it("renders two distinct blocks, never one card", async () => {
    const { container } = await renderProfile();
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Reputation" })).toBeInTheDocument(),
    );
    expect(container.querySelectorAll("[data-pass-block]")).toHaveLength(2);
  });

  it("places a visible rule between them", async () => {
    await renderProfile();
    await waitFor(() =>
      expect(
        screen.getByRole("separator", { name: "End of PASS performance" }),
      ).toBeInTheDocument(),
    );
  });

  it("never shows a combined trust score", async () => {
    await renderProfile();
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Reputation" })).toBeInTheDocument(),
    );
    const text = document.body.textContent?.toLowerCase() ?? "";
    expect(text).not.toContain("trust score");
    expect(text).not.toContain("trust rating");
  });

  it("shows the Ethos score and the PASS metrics under their own headings", async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText("1,392")).toBeInTheDocument());
    expect(screen.getByText(/\/\/ PASS Performance/)).toBeInTheDocument();
    expect(screen.getByText(/\/\/ Reputation/)).toBeInTheDocument();
  });

  it("carries the Ethos disclaimer", async () => {
    await renderProfile();
    await waitFor(() =>
      expect(
        screen.getByText(/not an absolute measure of credibility/i),
      ).toBeInTheDocument(),
    );
  });
});

describe("Active Passes (§10.4 item 3)", () => {
  it("renders a Pass row linking to the Pass page", async () => {
    await renderProfile([
      {
        publicId: "UvvuxpWPZ4",
        asset: "BTC",
        direction: "long",
        status: "active",
        entryPrice: "113400",
        takeProfit: "116000",
        stopLoss: "111900",
      },
    ]);
    const link = await screen.findByRole("link", { name: /UvvuxpWPZ4|BTC/ });
    expect(link).toHaveAttribute("href", "/p/UvvuxpWPZ4");
    expect(await screen.findByText("113,400")).toBeInTheDocument();
  });

  it("shows the empty state and the one action that creates a Pass", async () => {
    await renderProfile([]);
    expect(await screen.findByText("No active Passes")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a Pass" }),
    ).toHaveAttribute("href", "/passes/new");
  });

  it("never shows performance metrics on a Discover-style row (§10.2)", async () => {
    // The user has taken nothing; PASS does not imply account performance
    // proves Pass performance (PRD §13).
    await renderProfile([
      {
        publicId: "UvvuxpWPZ4",
        asset: "BTC",
        direction: "long",
        status: "active",
      },
    ]);
    await screen.findByText("No active Passes").catch(() => {});
    expect(document.body.textContent).not.toMatch(/realized/i);
  });
});

describe("Trader profile states", () => {
  it("shows a loading state that announces itself as busy", () => {
    let release: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<TraderProfileClient slug="turnttfup99" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    release(PROFILE);
  });
});

describe("Extension handoff", () => {
  it("is served at /u/{slug}, the URL the extension emits (D-019.3)", async () => {
    await renderProfile();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Demo Trader",
      ),
    );
    // The profile's own slug is what the extension constructs, so it must be
    // present and equal to the route segment the extension uses.
    expect(screen.getByText("turnttfup99")).toBeInTheDocument();
  });
});

/**
 * §14.4 assertions for the trader profile. Added 2026-10-07 on the rebuild.
 *
 * The 13 tests above were all green BEFORE the rebuild and would have stayed
 * green after a purely cosmetic change. They pin the contracts D-007 and §10.4
 * depend on; these pin the §14 reference language.
 */
describe("Trader profile reference language (14.4)", () => {
  it("frames the credential header with corner brackets", async () => {
    const { container } = await renderProfile();
    await screen.findByRole("heading", { level: 1 });
    // §14.2 rations brackets to four uses product-wide. Two went to Landing and
    // one to /how-it-works, so exactly one is left and this is it.
    expect(container.querySelectorAll(".pass-brackets")).toHaveLength(1);
  });

  it("uses the numbered eyebrow, not a lettered one", async () => {
    const { container } = await renderProfile();
    await screen.findByRole("heading", { level: 1 });
    expect(container.querySelector(".pass-numbered-eyebrow-number")).toBeTruthy();
  });

  it("states the credential in the 14.4 form with one accent word", async () => {
    const { container } = await renderProfile();
    await screen.findByRole("heading", { level: 1 });
    const line = container.querySelector(".pass-display-sub") as HTMLElement;
    expect(line.textContent).toContain("@turnttfup99 is");
    expect(line.textContent).toContain("verified on PASS");
    // Exactly one accent word on the line: two would stop either one from
    // pointing at anything.
    expect(line.querySelectorAll(".pass-display-accent")).toHaveLength(1);
    expect(line.querySelector(".pass-display-accent")?.textContent).toBe("verified");
  });

  it("keeps the display name the h1 and the handle off the h1", async () => {
    await renderProfile();
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Demo Trader");
    // A handle is an identifier, not a title.
    expect(h1.textContent).not.toContain("@turnttfup99");
  });

  it("puts reputation BEFORE PASS performance, separated by the rule", async () => {
    await renderProfile();
    await screen.findByRole("region", { name: "Reputation" });
    // §14.4: on a profile the reader is judging a PERSON, so who they are
    // precedes what they published.
    const dom = document.body.textContent ?? "";
    expect(dom.indexOf("Reputation")).toBeLessThan(dom.indexOf("PASS Performance"));
  });

  it("frames each of the two blocks as a card, and never merges them", async () => {
    const { container } = await renderProfile();
    await screen.findByRole("region", { name: "Reputation" });
    // Two separate frames. One frame holding both IS the merge, and it would
    // still pass every assertion above.
    expect(container.querySelectorAll(".pass-data-card")).toHaveLength(2);
  });

  it("states the Ethos score exactly once across the screen", async () => {
    await renderProfile();
    await waitFor(() => expect(screen.getByText("1,392")).toBeInTheDocument());
    // §11.4: one figure, one place.
    expect(screen.getAllByText("1,392").length).toBe(1);
  });

  it("says the un-reported metrics are omitted rather than estimating them", async () => {
    await renderProfile();
    await screen.findByRole("region", { name: "Reputation" });
    // The API returns no win rate / average R / TP-hit rate for a trader. §10.2
    // forbids inventing them, so the screen has to say so rather than leave a
    // reader wondering whether PASS simply has a bad win rate.
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/not reported by the PASS API/i);
    expect(text).toMatch(/omitted rather than estimated/i);
  });

it("renders the Active Passes list on the 14.8 grid, not as rows", async () => {
    const { container } = await renderProfile([
      {
        publicId: "UvvuxpWPZ4",
        asset: "BTC",
        direction: "long",
        status: "active",
        entryPrice: "113400",
        takeProfit: "116000",
        stopLoss: "111900",
      },
    ]);
    const link = await screen.findByRole("link", { name: /BTC/ });
    expect(link).toHaveAttribute("href", "/p/UvvuxpWPZ4");
    expect(container.querySelector(".pass-cards-grid")).toBeTruthy();
  });

  it("makes the whole card the link, with no nested anchor", async () => {
    await renderProfile([
      {
        publicId: "UvvuxpWPZ4",
        asset: "BTC",
        direction: "long",
        status: "active",
      },
    ]);
    await screen.findByRole("link", { name: /BTC/ });
    // An <a> inside an <a> is invalid HTML and breaks hydration, so the card
    // must not also pass DataCard an `action`.
    const nested = Array.from(
      document.querySelectorAll(".pass-card-link a"),
    ).filter((a) => a.closest(".pass-card-link") !== a);
    expect(nested).toHaveLength(0);
  });

  it("keeps the trailing affordance muted, not accent", async () => {
    await renderProfile([
      {
        publicId: "UvvuxpWPZ4",
        asset: "BTC",
        direction: "long",
        status: "active",
      },
    ]);
    await screen.findByRole("link", { name: /BTC/ });
    // §2.5: the accent is spent once. An accented "View Pass" per card would
    // spend it once per card and stop it pointing at anything.
    expect(document.querySelector(".pass-row-arrow")?.className).not.toMatch(
      /accent/,
    );
  });

  it("keeps the route slug as a plain datum, not a performance figure", async () => {
    await renderProfile();
    await screen.findByRole("heading", { level: 1 });
    // D-019.3: the extension emits /u/{slug}, so the slug must be present and
    // legible, but it is a URL convention and must not be dressed as a stat.
    expect(screen.getByText("Profile slug")).toBeInTheDocument();
  });

  it("shows an unavailable Ethos state instead of removing the block", async () => {
    mockGet.mockImplementation((url?: unknown) =>
      Promise.resolve(
        typeof url === "string" && url.includes("/passes")
          ? { passes: [] }
          : { ...PROFILE, reputation: null },
      ),
    );
    await act(async () => {
      render(<TraderProfileClient slug="turnttfup99" />);
    });
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/Ethos unavailable/i);
    // The distinction that matters: an unresolved external profile must not read
    // as "this trader has no reputation".
    expect(status.textContent).toMatch(/does not mean the trader lacks a reputation/i);
    // And the block is still there, with the rule still in place.
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });
});

const DISCONNECTED = {
  ...PROFILE,
  connections: [
    { provider: "x", connected: false, label: "X not connected" },
    { provider: "hyperliquid", connected: false, label: "Hyperliquid not linked" },
    { provider: "ethos", connected: false, label: "Ethos reputation not resolved" },
  ],
};

describe("Trader profile — disconnected author (single-state rule)", () => {
  it("hides handle link, address and reputation but keeps everything published", async () => {
    await renderProfile(
      [{ publicId: "UvvuxpWPZ4", asset: "BTC", direction: "long", status: "active" }],
      DISCONNECTED,
    );
    await screen.findByRole("heading", { level: 1 });
    // No X link, no connection chips, no Hyperliquid line, no Ethos block.
    expect(screen.queryByRole("link", { name: "X" })).toBeNull();
    expect(screen.queryByText("X connected")).toBeNull();
    expect(screen.queryByText("Hyperliquid")).toBeNull();
    expect(screen.queryByRole("region", { name: "Reputation" })).toBeNull();
    // Published identity and passes stay: display name, bio, pass card.
    expect(screen.getByText("Demo Trader")).toBeInTheDocument();
    expect(screen.getByText("BTC / ETH perpetual trader.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /BTC/ })).toBeInTheDocument();
  });
});
