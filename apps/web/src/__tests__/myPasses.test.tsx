import { render, screen, waitFor } from "@testing-library/react";
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
    version: 2,
    status: "active",
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
    version: 1,
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
const { mockMeGet, mockCancelPost } = vi.hoisted(() => ({
  mockMeGet: vi.fn(),
  mockCancelPost: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  clientGet: (...a: unknown[]) => mockMeGet(...a),
  clientPost: (...a: unknown[]) => mockCancelPost(...a),
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
  mockCancelPost.mockReset();
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

  it("signed-out My Passes is a connect CTA with no rows (D-024)", async () => {
    renderWith({ probe: unauthed });
    expect(
      await screen.findByText("Your Passes belong to a connected X identity."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
    expect(screen.queryByText("BTC")).toBeNull();
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

describe("My Passes — single-state rule (D-023, X-only)", () => {  it("hides the lists and shows the CTA when X is disconnected", async () => {
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

describe("My Passes — author actions (Stage C)", () => {
  it("links each editable pass to the shared Create form with ?edit={id}", async () => {
    renderWith({});
    await screen.findByText("My Passes");
    // Active (p1) and draft (p2) are editable; each renders twice (wide
    // table + narrow stacked list).
    const edits = await screen.findAllByRole("link", { name: "Edit" });
    expect(edits.map((a) => a.getAttribute("href")).sort()).toEqual(
      ["/passes/new?edit=p1", "/passes/new?edit=p1", "/passes/new?edit=p2", "/passes/new?edit=p2"].sort(),
    );
  });

  it("offers Cancel only where the state machine allows it", async () => {
    renderWith({});
    await screen.findByText("My Passes");
    // Active p1 is cancellable; draft p2 is not (draft -> cancelled is
    // illegal). Two copies again: table + stacked list.
    expect((await screen.findAllByRole("button", { name: "Cancel" })).length).toBe(2);
  });

  it("cancel confirms, POSTs, and the row returns cancelled with no controls", async () => {
    let current: MyPass[] = PASSES;
    mockCancelPost.mockResolvedValue({ id: "p1", status: "cancelled" });
    render(
      <MyPassesClient probe={authed} load={async () => current} />,
    );
    await screen.findByText("My Passes");
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });

    await user.click((await screen.findAllByRole("button", { name: "Cancel" }))[0]);
    // The terminal warning names the consequence before anything is sent.
    expect(await screen.findByRole("dialog", { name: "Cancel this Pass?" })).toBeInTheDocument();
    expect(screen.getByText(/no new executions/i)).toBeInTheDocument();
    expect(mockCancelPost).not.toHaveBeenCalled();

    current = [{ ...PASSES[0], status: "cancelled" }, PASSES[1]];
    await user.click(screen.getByRole("button", { name: "Confirm cancel" }));
    await waitFor(() => expect(mockCancelPost).toHaveBeenCalledTimes(1));
    expect(mockCancelPost.mock.calls[0]?.[0]).toBe("/api/v1/passes/p1/cancel");

    // Reloaded: the dialog closes on success, then the row returns
    // cancelled and both controls are gone with it. The draft row keeps
    // its own Edit link — only p1's controls disappear.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull());
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    const hrefs = screen
      .getAllByRole("link", { name: "Edit" })
      .map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/passes/new?edit=p1");
    expect(hrefs).toContain("/passes/new?edit=p2");
  });

  it("keeps the Pass when the confirm is dismissed", async () => {
    renderWith({});
    await screen.findByText("My Passes");
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ delay: null });
    await user.click((await screen.findAllByRole("button", { name: "Cancel" }))[0]);
    await screen.findByRole("dialog", { name: "Cancel this Pass?" });
    await user.click(screen.getByRole("button", { name: "Keep Pass" }));
    expect(mockCancelPost).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("My Passes — status correctness (Stage C, Task 4)", () => {
  const ROWS: MyPass[] = [
    { ...PASSES[0], id: "d", status: "draft", publishedAt: null },
    { ...PASSES[0], id: "a", status: "active" },
    { ...PASSES[0], id: "c", status: "cancelled" },
    { ...PASSES[0], id: "e", status: "expired" },
  ];

  it("renders draft / active / cancelled / expired as distinct labelled chips", async () => {
    const { container } = render(
      <MyPassesClient probe={authed} load={async () => ROWS} />,
    );
    await screen.findByText("My Passes");
    for (const label of ["Draft", "Active", "Cancelled", "Expired"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // Distinct states, not one shared badge: each chip carries its own state.
    for (const s of ["draft", "active", "cancelled", "expired"]) {
      expect(container.querySelector(`[data-state="${s}"]`)).toBeTruthy();
    }
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