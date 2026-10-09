import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExecutionsClient, type Execution } from "@/app/me/executions/ExecutionsClient";
import { PERIODS, inWindow, periodWindow } from "@/lib/period";

/** §10.9. No rejected promise anywhere — states are injected resolvers. */

// Fail-open default for the connection snapshot: the /me read rejects, so
// existing tests observe the lists exactly as before (see use-me.ts).
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

beforeEach(() => {
  mockMeGet.mockReset();
  mockMeGet.mockRejectedValue(new Error("no session snapshot"));
});

/** Minutes before real now, so the default 7D window contains it. */
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const NOW = new Date();

const EXEC: Execution = {
  id: "e1",
  passId: "0xabcdef0123456789abcdef0123456789abcdef01",
  passVersion: 3,
  providerOrderId: "hl-order-99881",
  providerStatus: "FILLED",
  status: "executed",
  asset: "BTC",
  direction: "LONG",
  positionSize: "0.25",
  entryFill: "113400.00",
  realizedPnl: "642.50",
  createdAt: ago(30),
};

const authed = async () => true;
const unauthed = async () => false;

describe("periodWindow — one convention, half-open, offset from now", () => {
  it("offers four windows ending now", () => {
    expect(PERIODS.map((p) => p.id)).toEqual(["24h", "7d", "30d", "all"]);
  });

  it("resolves a lookback as an offset from now, not a frozen date", () => {
    const w = periodWindow("24h", NOW);
    expect(w.end.getTime()).toBe(NOW.getTime());
    expect(w.start.getTime()).toBe(NOW.getTime() - 24 * 60 * 60_000);
  });

  it("treats the window as half-open [start, end)", () => {
    const w = periodWindow("24h", NOW);
    // Exactly at the start: inside.
    expect(inWindow(w.start, w)).toBe(true);
    // Exactly at the end: outside. A closed range would double-count this row
    // in two consecutive windows.
    expect(inWindow(w.end, w)).toBe(false);
  });

  it("makes the unbounded window cover all real timestamps", () => {
    const w = periodWindow("all", NOW);
    expect(inWindow("2020-01-01T00:00:00.000Z", w)).toBe(true);
    expect(inWindow(NOW, w)).toBe(false); // end is exclusive, and is now
  });

  it("rejects unparseable and missing timestamps rather than guessing", () => {
    const w = periodWindow("all", NOW);
    expect(inWindow(null, w)).toBe(false);
    expect(inWindow("nonsense", w)).toBe(false);
  });
});

describe("Executions (§10.9)", () => {
  it("states the SPECIFIC reason when unauthorized", async () => {
    render(<ExecutionsClient probe={unauthed} load={async () => [EXEC]} />);
    expect(
      await screen.findByText("Your execution history belongs to a connected account."),
    ).toBeInTheDocument();
  });

  it("signed-out Executions is a connect CTA with no rows (D-024)", async () => {
    render(<ExecutionsClient probe={unauthed} load={async () => [EXEC]} />);
    expect(
      await screen.findByText("Your execution history belongs to a connected account."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with X" })).toBeInTheDocument();
    expect(screen.queryByText("hl-order-99881")).toBeNull();
  });

  it("renders a busy loading state", () => {
    render(
      <ExecutionsClient probe={authed} load={() => new Promise<Execution[]>(() => {})} />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading your executions")).toBeInTheDocument();
  });

  it("renders the error state with Retry", async () => {
    render(
      <ExecutionsClient
        probe={authed}
        load={async () => {
          throw new Error("ledger unreachable");
        }}
      />,
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(await screen.findByText("ledger unreachable")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders the empty state", async () => {
    render(<ExecutionsClient probe={authed} load={async () => []} />);
    expect(await screen.findByText("No executions yet")).toBeInTheDocument();
  });

  it("renders the row with size, fill, status, PnL and time", async () => {
    render(<ExecutionsClient probe={authed} load={async () => [EXEC]} />);
    expect((await screen.findAllByText("0.25")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("113,400.00")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/EXECUTED/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("30m ago")).length).toBeGreaterThan(0);
  });

  it("shows PnL sign AND colour together (§9.4, §10.9.1)", async () => {
    render(<ExecutionsClient probe={authed} load={async () => [EXEC]} />);
    const pnl = await screen.findAllByText(/\+642\.50 USDC/);
    expect(pnl.length).toBeGreaterThan(0);
    // The sign is in the text, and the tone reinforces it — never colour alone.
    expect(pnl[0].getAttribute("data-tone")).toBe("positive");
  });

  it("renders a negative PnL with an explicit minus, not just a colour", async () => {
    render(
      <ExecutionsClient
        probe={authed}
        load={async () => [{ ...EXEC, realizedPnl: "-120.25" }]}
      />,
    );
    const pnl = await screen.findAllByText(/\u2212120\.25 USDC/);
    expect(pnl.length).toBeGreaterThan(0);
    expect(pnl[0].getAttribute("data-tone")).toBe("negative");
  });

  it("hides row detail until expanded, then reveals order id and Pass version", async () => {
    render(<ExecutionsClient probe={authed} load={async () => [EXEC]} />);
    // Scope to the wide table: the narrow stacked list renders the same row
    // controls a second time by design, and both copies must work.
    const table = (await screen.findAllByTestId("data-table"))[0];
    const wide = within(table);
    const toggle = await wide.findByRole("button", { name: "Detail" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Not in the DOM before expansion.
    expect(screen.queryByText("hl-order-99881")).toBeNull();

    fireEvent.click(toggle);
    // The detail renders in both the wide table and the narrow stacked list.
    expect((await screen.findAllByText("hl-order-99881")).length).toBeGreaterThan(0);
    // The VERSION, not just the pass id: reconstructability needs the plan text
    // that was live when this executed.
    expect(screen.getAllByText("v3").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Hide detail" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("filters rows by the selected period window", async () => {
    const old: Execution = { ...EXEC, id: "e2", createdAt: "2025-01-01T00:00:00.000Z" };
    render(<ExecutionsClient probe={authed} load={async () => [EXEC, old]} />);
    const table = (await screen.findAllByTestId("data-table"))[0];
    const wide = within(table);
    await wide.findByRole("button", { name: "Detail" });
    // Default 7D window: the 30-minute-old row is in, the year-old one is not.
    expect(wide.getAllByRole("button", { name: "Detail" }).length).toBe(1);

    // ALL is unbounded, so both rows return.
    fireEvent.click(screen.getByRole("button", { name: "ALL" }));
    expect(wide.getAllByRole("button", { name: "Detail" }).length).toBe(2);
  });

  it("says so plainly when the window holds nothing", async () => {
    const future: Execution = { ...EXEC, createdAt: ago(60 * 24 * 40) };
    render(<ExecutionsClient probe={authed} load={async () => [future]} />);
    expect(await screen.findByText("Nothing in this period")).toBeInTheDocument();
  });
});

describe("Executions — single-state rule (D-023, X-only)", () => {
  it("hides the history and shows the CTA when X is disconnected", async () => {
    mockMeGet.mockResolvedValue(ME_OFF);
    render(<ExecutionsClient probe={authed} load={async () => [EXEC]} />);
    expect(
      await screen.findByText("Connect an account to see your executions."),
    ).toBeInTheDocument();
    expect(screen.queryByText("hl-order-99881")).toBeNull();
  });
});