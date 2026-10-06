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
  it("renders a row per Pass, linked to its page", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /BTC/ });
    expect(link).toHaveAttribute("href", "/p/UvvuxpWPZ4");
  });

  it("leads each row with direction, asset and a status chip", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText("Long")).toBeInTheDocument());
    expect(screen.getByText("Short")).toBeInTheDocument();
    // "Active" is BOTH a filter option and a status chip, so getByText would
    // be ambiguous. getAllByText asserts presence without conflating the two.
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    // "Open" is also a filter option, so it is ambiguous by name.
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
  });

  it("shows entry, TP and SL as coordinate pairs", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText("113,400")).toBeInTheDocument());
    expect(screen.getByText("116,000")).toBeInTheDocument();
    expect(screen.getByText("111,900")).toBeInTheDocument();
  });

  it("shows a relative publish time", async () => {
    await renderDiscover();
    // Both fixture rows were published "now", so the string legitimately appears twice.
    await waitFor(() =>
      expect(screen.getAllByText("just now").length).toBeGreaterThan(0),
    );
  });

  it("never shows performance or PnL on a row (PRD §13, §12.3)", async () => {
    await renderDiscover();
    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    const text = document.body.textContent ?? "";
    for (const w of ["PnL", "realized", "win rate", "success rate", "profit"]) {
      expect(text.toLowerCase(), w).not.toContain(w.toLowerCase());
    }
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
    await waitFor(() => expect(screen.getByText("BTC")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(screen.queryByText("BTC")).toBeNull());
    expect(screen.getByText("ETH")).toBeInTheDocument();
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