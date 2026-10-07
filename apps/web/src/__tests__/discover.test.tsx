import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DiscoverClient } from "../app/discover/DiscoverClient";

/**
 * Discover — design/DESIGN.md §10.2.
 *
 * The row anatomy assertion is the one that matters: §10.2 and PRD §13 forbid a
 * Discover row showing performance metrics, because the user has taken nothing
 * and account performance must never imply Pass performance. That is a product
 * rule, so it is asserted rather than left to review.
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("@/lib/client", () => ({ clientGet: (...a: unknown[]) => mockGet(...a) }));

const PASSES = [
  {
    publicId: "UvvuxpWPZ4",
    asset: "BTC",
    direction: "long",
    status: "active",
    entryPrice: "113400",
    takeProfit: "116000",
    stopLoss: "111900",
    publishedAt: new Date().toISOString(),
    canonicalPath: "/p/UvvuxpWPZ4",
  },
  {
    publicId: "DKP3xhs7JB",
    asset: "ETH",
    direction: "short",
    status: "open",
    entryPrice: "4120.55",
    takeProfit: "3950",
    stopLoss: "4280",
    publishedAt: new Date().toISOString(),
    canonicalPath: "/p/DKP3xhs7JB",
  },
];

beforeEach(() => mockGet.mockReset());

async function renderDiscover(passes: unknown[] = PASSES) {
  mockGet.mockImplementation((url?: unknown) =>
    Promise.resolve(
      typeof url === "string" && url.includes("/discover") ? { passes } : {},
    ),
  );
  let out!: ReturnType<typeof render>;
  await act(async () => {
    out = render(<DiscoverClient />);
  });
  return out;
}

describe("Discover list (§10.2 item 1)", () => {
  it("renders a card per Pass, linked to its page", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText(/BTC LONG/)).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /Open BTC long Pass/ });
    expect(link).toHaveAttribute("href", "/p/UvvuxpWPZ4");
  });

  it("leads each card with asset, direction and a state word", async () => {
    await renderDiscover();
    // §14.5 replaced the old "DirectionBadge -> asset -> StatusChip" row header
    // with a single ember identifier plus a state aside. The §10.2 RULE behind
    // that order still binds: direction is visible, and it is distinguishable
    // from the state. Both now live in different elements.
    await waitFor(() => expect(screen.getByText("BTC LONG")).toBeInTheDocument());
    expect(screen.getByText("ETH SHORT")).toBeInTheDocument();
    // "Active" and "Open" are BOTH filter chips and state words, so getAllByText
    // asserts presence without conflating the two.
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("shows entry, TP and SL as labelled metric rows", async () => {
    await renderDiscover();
    // Every card carries the three plan levels, so the labels legitimately appear
    // once per card. §14.5 spells them out rather than abbreviating to TP/SL:
    // an abbreviation next to a figure is one more thing to decode mid-scan.
    await waitFor(() => expect(screen.getAllByText("Take profit").length).toBe(2));
    expect(screen.getAllByText("Stop loss").length).toBe(2);
    expect(screen.getByText("116,000")).toBeInTheDocument();
    expect(screen.getByText("111,900")).toBeInTheDocument();
    // §11.2 the entry figure is the card's primary value.
    const cards = document.querySelectorAll(".pass-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector(".pass-card-value")?.textContent).toContain("113,400");
  });

  it("shows a relative publish time", async () => {
    await renderDiscover();
    // Both fixture cards were published "now", so the string legitimately appears
    // twice. §11.5 puts it in the muted sub-line, not in the identifier.
    await waitFor(() =>
      expect(screen.getAllByText(/published just now/i).length).toBeGreaterThan(0),
    );
  });

  it("never shows realized performance on a card (PRD §13, §12.3)", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText(/BTC LONG/)).toBeInTheDocument());
    const text = (document.body.textContent ?? "").toLowerCase();
    // A blunt "profit" ban cannot work here: "Take profit" is a LEVEL OF THE
    // PLAN, not a result, and §11.3 requires it. What must never appear is a
    // figure of somebody's outcome.
    for (const w of ["pnl", "realized", "realised", "unrealized", "win rate", "success rate", "profit factor", "roi", "equity curve"]) {
      expect(text, w).not.toContain(w);
    }
    // And the plan levels it does show are stated as levels.
    expect(text).toContain("take profit");
    expect(text).toContain("stop loss");
  });

  it("shows a mono result count so the list is self-describing", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText("2 Passes")).toBeInTheDocument());
  });
});

describe("Discover filters (§10.2 item 2)", () => {
  it("offers a visible status filter, never behind a menu", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    expect(screen.getByRole("group", { name: "Filter by status" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("filters client-side without blanking the list", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    await renderDiscover();
    await waitFor(() => expect(screen.getByText(/BTC LONG/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.queryByText(/BTC LONG/)).toBeNull());
    expect(screen.getByText(/ETH SHORT/)).toBeInTheDocument();
  });
});

/**
 * §14 assertions for Discover. Added 2026-10-07 when the screen was rebuilt from
 * a list of text rows into a card grid. The operator's report on this screen was
 * "colors not applied, feels dull", and the cause was structural: a list of rows
 * cannot carry §14.5's card anatomy, so nothing the token layer added could make
 * it feel like the reference.
 */
describe("Discover reference language (§14)", () => {
  it("renders a card per Pass, not a row", async () => {
    const { container } = await renderDiscover();
    await waitFor(() => expect(container.querySelectorAll(".pass-card")).toHaveLength(2));
    // The old row link is gone: a row cannot become a card by restyling.
    expect(container.querySelectorAll(".pass-row-link")).toHaveLength(0);
  });

  it("puts the section wash and grain on the header", async () => {
    const { container } = await renderDiscover();
    const head = container.querySelector(".pass-discover-head") as HTMLElement;
    // §14.1's section strength, not hero: this is a data-heavy page.
    expect(head.getAttribute("data-strength")).toBe("section");
    expect(head.querySelector(".pass-wash-layer")).toBeTruthy();
    expect(head.querySelector(".pass-grain")).toBeTruthy();
  });

  it("carries the ticker bar and derives it from the loaded Passes", async () => {
    const { container } = await renderDiscover();
    await waitFor(() => expect(container.querySelector(".pass-ticker")).toBeTruthy());
    const symbols = Array.from(container.querySelectorAll(".pass-ticker-symbol")).map(
      (s) => s.textContent,
    );
    expect(symbols).toContain("BTC");
    expect(symbols).toContain("ETH");
  });

  it("states the unavailable ticker rather than rendering an empty bar", async () => {
    await renderDiscover([]);
    // §14.8: an empty bar would read as "no markets moved".
    expect(await screen.findByText("Market data unavailable")).toBeInTheDocument();
  });

  it("numbers the sections with the numbered eyebrow", async () => {
    const { container } = await renderDiscover();
    await waitFor(() =>
      expect(container.querySelectorAll(".pass-numbered-eyebrow-number").length).toBeGreaterThan(0),
    );
  });

  it("gives the h1 one ember word on its first line", async () => {
    const { container } = await renderDiscover();
    const h1 = container.querySelector("h1") as HTMLElement;
    const lines = h1.querySelectorAll(".pass-display-line");
    expect(lines).toHaveLength(2);
    expect(lines[0].querySelectorAll(".pass-display-accent")).toHaveLength(1);
    expect(lines[1].querySelectorAll(".pass-display-accent")).toHaveLength(0);
  });

  it("marks exactly one filter chip as pressed (§2.5 one accent fill per region)", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText(/BTC LONG/)).toBeInTheDocument());
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveTextContent("All");
  });

  it("renders no sparkline when the payload carries no series (§11.2)", async () => {
    const { container } = await renderDiscover();
    await waitFor(() => expect(container.querySelectorAll(".pass-card")).toHaveLength(2));
    // A flat line would be an invented observation.
    expect(container.querySelectorAll(".pass-sparkline")).toHaveLength(0);
  });

  it("renders a sparkline when a real series arrives", async () => {
    const { container } = await renderDiscover([
      { ...PASSES[0], sparkline: [110, 112, 111, 113.4, 114, 113.4] },
    ]);
    await waitFor(() => expect(container.querySelector(".pass-sparkline")).toBeTruthy());
    expect(screen.getByRole("img", { name: /BTC last 24 hours/i })).toBeInTheDocument();
  });

  it("renders R:R as a derived figure of the plan, and a dash when inputs are missing", async () => {
    const { container } = await renderDiscover();
    await waitFor(() => expect(container.querySelectorAll(".pass-card")).toHaveLength(2));
    const values = Array.from(container.querySelectorAll(".pass-card-metric dd")).map(
      (d) => d.textContent,
    );
    expect(values).toContain("1.73:1");

    const { container: broken } = await renderDiscover([
      { ...PASSES[0], entryPrice: "0", takeProfit: "0", stopLoss: "0" },
    ]);
    await waitFor(() => expect(broken.querySelectorAll(".pass-card")).toHaveLength(1));
    const rr = Array.from(broken.querySelectorAll(".pass-card-metric")).find((m) =>
      m.querySelector("dt")?.textContent?.includes("R:R"),
    );
    expect(rr?.querySelector("dd")?.textContent).toBe("—");
  });

  it("uses only the documented class vocabulary", async () => {
    const { container } = await renderDiscover();
    await waitFor(() => expect(container.querySelectorAll(".pass-card").length).toBeGreaterThan(0));
    const ALLOWED = new Set(["visually-hidden", "pass-row-link-plain"]);
    const classes = Array.from(container.querySelectorAll("[class]")).flatMap((el) =>
      (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
    );
    for (const c of classes) {
      expect(c.startsWith("pass-") || ALLOWED.has(c), c).toBe(true);
    }
  });
});

describe("Discover states", () => {
  it("shows a loading state that announces itself as busy", () => {
    let release: (v: unknown) => void = () => {};
    mockGet.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    render(<DiscoverClient />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    release({ passes: [] });
  });

  it("shows an empty state naming the absence and offering Create a Pass", async () => {
    await renderDiscover([]);
    expect(await screen.findByText("No Passes match this filter")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a Pass" })).toHaveAttribute(
      "href",
      "/passes/new",
    );
  });
});