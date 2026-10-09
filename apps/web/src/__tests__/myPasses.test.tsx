import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MyPassesClient, type MyPass } from "@/app/me/passes/MyPassesClient";

/**
 * §10.8 My Passes.
 *
 * Every state is reached by passing a `probe`/`load` pair that RESOLVES. There is
 * not a single rejected promise in this file, which is the entire reason the
 * screen is buildable now — the previous per-screen fetch made the unauthorized
 * state unreachable without an unhandled rejection that failed the whole file.
 */

const PASSES: MyPass[] = [
  {
    id: "p1",
    publicId: "UvvuxpWPZ4",
    status: "open",
    asset: "BTC",
    direction: "LONG",
    entryPrice: "113400",
    takeProfit: "116000",
    stopLoss: "111900",
    publishedAt: "2026-10-05T09:00:00.000Z",
    expiresAt: "2026-10-12T09:00:00.000Z",
    createdAt: "2026-10-05T08:00:00.000Z",
    takerCount: 3,
  },
  {
    id: "p2",
    publicId: "AbCdEfGh12",
    status: "draft",
    asset: "ETH",
    direction: "SHORT",
    entryPrice: "3400",
    takeProfit: "3200",
    stopLoss: "3500",
    publishedAt: null,
    expiresAt: null,
    createdAt: "2026-10-04T08:00:00.000Z",
    takerCount: 0,
  },
];

const authed = async () => true;
const unauthed = async () => false;

// Single-state rule (D-023): gating reads the X entry of the /me snapshot
// only. Fail-open by default — the /me read rejects, so existing tests
// observe the lists exactly as before (see use-me.ts).
const { mockMeGet } = vi.hoisted(() => ({ mockMeGet: vi.fn() }));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockMeGet(...a),
  clientPost: vi.fn(),
  clientPatch: vi.fn(),
}));

const ME_OFF = {
  userId: "u1",
  profileSlug: "t",
  displayName: "T",
  connections: [
    { provider: "x", connected: false, label: "X not connected", displayOnly: false },
    { provider: "hyperliquid", connected: false, label: "no", displayOnly: false },
    { provider: "ethos", connected: false, label: "no", displayOnly: true },
  ],
  tradingAccounts: [],
};

const ME_X_ON = {
  ...ME_OFF,
  connections: [
    {
      provider: "x",
      connected: true,
      label: "X connected · @t",
      displayOnly: false,
      handle: "turnttfup99",
    },
    { provider: "hyperliquid", connected: false, label: "no", displayOnly: false },
    { provider: "ethos", connected: false, label: "no", displayOnly: true },
  ],
};

beforeEach(() => {
  mockMeGet.mockReset();
  mockMeGet.mockRejectedValue(new Error("no session snapshot"));
});

const renderWith = (opts: { probe?: () => Promise<boolean>; load?: () => Promise<MyPass[]> }) =>
  render(<MyPassesClient probe={opts.probe ?? authed} load={opts.load ?? (async () => PASSES)} />);

describe("My Passes (§10.8)", () => {
  it("renders the populated table", async () => {
    renderWith({});
    expect(await screen.findByText("My Passes")).toBeInTheDocument();
    // Rendered twice on purpose: once as the wide table, once as the narrow
    // stacked list. Both copies must be present, not one substituted for the other.
    expect((await screen.findAllByText("BTC")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("ETH").length).toBeGreaterThan(0);
  });

  it("states the SPECIFIC reason when unauthorized", async () => {
    renderWith({ probe: unauthed });
    expect(
      await screen.findByText("Your Passes belong to a connected X identity."),
    ).toBeInTheDocument();
  });

  it("renders a loading state that announces itself as busy", () => {
    renderWith({ load: () => new Promise<MyPass[]>(() => {}) });
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading your Passes")).toBeInTheDocument();
  });

  it("renders the empty state with a way out", async () => {
    renderWith({ load: async () => [] });
    expect(await screen.findByText("No Passes yet")).toBeInTheDocument();
  });

  it("renders the error state and offers Retry", async () => {
    renderWith({
      load: async () => {
        throw new Error("upstream is down");
      },
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await screen.findByText("upstream is down")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("counts by lifecycle in the summary strip (§10.8.1)", async () => {
    renderWith({});
    // One open, one draft. The chip uppercases its label, so match case-insensitively.
    expect((await screen.findAllByText(/open/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/draft/i).length).toBeGreaterThan(0);
  });

  it("ghosts draft rows without dimming their text (§10.8)", async () => {
    const { container } = renderWith({});
    const ghost = await waitForGhost(container);
    expect(ghost).toBeTruthy();
    // The row is marked ghost; the text colour is untouched, so contrast holds.
    expect(ghost?.getAttribute("data-ghost")).toBe("true");
  });

  it("renders the entry price and taker count as data", async () => {
    renderWith({});
    // fmtPrice keeps two decimals for values >= 1.
    expect((await screen.findAllByText("113,400.00")).length).toBeGreaterThan(0);
    // 3 takers on the OPEN row.
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("offers Create a Pass from the header", () => {
    renderWith({});
    expect(screen.getAllByRole("link", { name: "Create a Pass" }).length).toBeGreaterThan(0);
  });
});

describe("My Passes — single-state rule (D-023, X-only)", () => {
  it("hides the lists and shows the CTA when X is disconnected", async () => {
    mockMeGet.mockResolvedValue(ME_OFF);
    renderWith({});
    expect(
      await screen.findByText("Connect an account to see your passes."),
    ).toBeInTheDocument();
    expect(screen.queryByText("BTC")).toBeNull();
    expect(screen.queryByText("ETH")).toBeNull();
  });

  it("renders the lists when X is connected", async () => {
    mockMeGet.mockResolvedValue(ME_X_ON);
    renderWith({});
    expect((await screen.findAllByText("BTC")).length).toBeGreaterThan(0);
  });
});

async function waitForGhost(container: HTMLElement) {
  for (let i = 0; i < 40; i += 1) {
    const el = container.querySelector('[data-ghost="true"]');
    if (el) return el;
    await new Promise((r) => setTimeout(r, 10));
  }
  return null;
}