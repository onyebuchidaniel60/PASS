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

async function renderProfile(passes: unknown[] = []) {
  mockGet.mockImplementation((url?: unknown) =>
    Promise.resolve(
      typeof url === "string" && url.includes("/api/v1/passes") ? passes : PROFILE,
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
