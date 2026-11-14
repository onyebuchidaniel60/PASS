import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "@/components/GlobalSearch";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("@/lib/client", () => ({
  clientGet: (...args: unknown[]) => mockGet(...args),
}));

const RESULTS = {
  query: "BTC",
  traders: [
    {
      slug: "btcwhale",
      handle: "btcwhale",
      displayName: "BTC Whale",
      avatarUrl: null,
    },
  ],
  passes: [
    {
      publicId: "AGENT01",
      asset: "BTC",
      direction: "long",
      status: "tp_hit",
      entryType: "limit",
      entryPrice: "113400",
      stopLoss: "111900",
      takeProfit: "116000",
      leverage: "5",
      publishedAt: new Date().toISOString(),
      trader: {
        slug: "btcwhale",
        handle: "btcwhale",
        displayName: "BTC Whale",
        avatarUrl: null,
      },
    },
  ],
};

beforeEach(() => {
  mockGet.mockReset();
});

describe("GlobalSearch", () => {
  it("opens from the topbar trigger and searches traders and Passes", async () => {
    mockGet.mockResolvedValue(RESULTS);
    render(<GlobalSearch />);

    fireEvent.click(screen.getByRole("button", { name: "Search PASS" }));
    expect(
      screen.getByRole("dialog", { name: "Search PASS" }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search traders and Passes" }),
      { target: { value: "BTC" } },
    );

    expect(await screen.findByText("BTC Whale")).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith("/api/v1/search?q=BTC");
    expect(screen.getByRole("heading", { name: "Traders" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Passes" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /BTC Whale/ }),
    ).toHaveAttribute("href", "/u/btcwhale");
    expect(
      screen.getByRole("link", { name: /BTC LONG/ }),
    ).toHaveAttribute("href", "/p/AGENT01");
  });

  it("opens with Cmd/Ctrl+K", () => {
    render(<GlobalSearch />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(
      screen.getByRole("dialog", { name: "Search PASS" }),
    ).toBeInTheDocument();
  });

  it("shows the hint before a query and a clean empty state after one", async () => {
    mockGet.mockResolvedValue({ query: "zzz", traders: [], passes: [] });
    render(<GlobalSearch />);

    fireEvent.click(screen.getByRole("button", { name: "Search PASS" }));
    expect(
      screen.getByText("Search by trader, asset, or Pass ID."),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search traders and Passes" }),
      { target: { value: "zzz" } },
    );

    expect(await screen.findByText("No results found.")).toBeInTheDocument();
  });

  it("closes on Escape and restores the page", () => {
    render(<GlobalSearch />);
    fireEvent.click(screen.getByRole("button", { name: "Search PASS" }));
    const input = screen.getByRole("searchbox", {
      name: "Search traders and Passes",
    });

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Search PASS" })).toBeNull();
  });

  it("closes from the explicit Close control", () => {
    render(<GlobalSearch />);
    fireEvent.click(screen.getByRole("button", { name: "Search PASS" }));
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(screen.queryByRole("dialog", { name: "Search PASS" })).toBeNull();
  });
});
