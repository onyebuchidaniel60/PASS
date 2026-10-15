import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DemoBanner } from "../components/DemoBanner";

/**
 * The banner names the venue always, names which surfaces are not live, and
 * never uses simulation language: orders execute on Hyperliquid and no
 * surface is labelled as a demo.
 *
 * The rule that matters most: the banner must never let a reader conclude
 * that taking a Pass is live while execution is not.
 */

function mockHealth(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 503,
      json: async () => body,
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DemoBanner reflects the real per-surface modes", () => {
  it("renders nothing before /health answers", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the venue when every surface is live", async () => {
    mockHealth({
      modes: {
        hyperliquidReads: "live",
        hyperliquidExecution: "live",
        ethos: "live",
        x: "live",
        database: "live",
      },
      hyperliquidVenue: "testnet",
    });
    render(<DemoBanner />);
    // The persistent indicator — and the only thing rendered when live.
    expect(await screen.findByText("Hyperliquid Testnet")).toBeInTheDocument();
  });

  it("renders nothing when live but the venue is unknown", async () => {
    mockHealth({
      modes: {
        hyperliquidReads: "live",
        hyperliquidExecution: "live",
        ethos: "live",
        x: "live",
        database: "live",
      },
    });
    const { container } = render(<DemoBanner />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("names the surfaces that are not live when reads are live but execution is not", async () => {
    mockHealth({
      modes: {
        hyperliquidReads: "live",
        hyperliquidExecution: "mock",
        ethos: "live",
        x: "mock",
      },
      hyperliquidVenue: "testnet",
    });
    render(<DemoBanner />);

    const banner = await screen.findByRole("status");
    // Live surfaces are NOT named as not-live.
    expect(banner.textContent).not.toMatch(/not live[^.]*market data/i);
    expect(banner.textContent).not.toMatch(/not live[^.]*ethos/i);
    // The non-live ones are.
    expect(banner.textContent).toMatch(/order execution/);
    expect(banner.textContent).toMatch(/\bx identity\b/);
    // The venue indicator still shows.
    expect(banner.textContent).toMatch(/Hyperliquid Testnet/);
  });

  it("says the deployment is partly live, not fully offline", async () => {
    mockHealth({
      modes: {
        hyperliquidReads: "live",
        hyperliquidExecution: "mock",
        ethos: "live",
        x: "mock",
      },
    });
    render(<DemoBanner />);
    const banner = await screen.findByRole("status");
    expect(banner.textContent).toMatch(/Partly live/);
    expect(banner.textContent).not.toMatch(/Offline mode\./);
  });

  it("states plainly that execution is paused and orders are not placed", async () => {
    mockHealth({
      modes: { hyperliquidReads: "live", hyperliquidExecution: "mock", ethos: "live", x: "mock" },
    });
    render(<DemoBanner />);
    // The most important sentences on the screen: a reader must never
    // think a Take would move money while execution is not live.
    expect(
      await screen.findByText(/Hyperliquid execution is paused/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Market data is live/i)).toBeInTheDocument();
    expect(await screen.findByText(/Orders are not placed/i)).toBeInTheDocument();
  });

  it("omits the execution sentence when execution really is live", async () => {
    mockHealth({
      modes: {
        hyperliquidReads: "live",
        hyperliquidExecution: "live",
        ethos: "mock",
        x: "live",
      },
    });
    render(<DemoBanner />);
    await screen.findByRole("status");
    expect(screen.queryByText(/Hyperliquid execution is paused/i)).toBeNull();
    // Ethos alone is still not live, so the banner stays.
    expect(screen.getByRole("status").textContent).toMatch(/ethos reputation/);
  });

  it("falls back to the combined hyperliquid flag when reads are absent", async () => {
    // Older API builds only report `hyperliquid`.
    mockHealth({ modes: { hyperliquid: "mock", ethos: "mock", x: "mock" } });
    render(<DemoBanner />);
    const banner = await screen.findByRole("status");
    expect(banner.textContent).toMatch(/Offline mode\./);
    expect(banner.textContent).toMatch(/order execution/);
    expect(banner.textContent).toMatch(/market data/);
  });

  it("never renders simulation language", async () => {
    mockHealth({
      modes: {
        hyperliquidReads: "live",
        hyperliquidExecution: "mock",
        ethos: "live",
        x: "mock",
      },
      hyperliquidVenue: "testnet",
    });
    render(<DemoBanner />);
    const banner = await screen.findByRole("status");
    const text = banner.textContent ?? "";
    for (const w of ["SIMULATED", "simulated", "mock", "Mock", "demo", "Demo"]) {
      expect(text, w).not.toContain(w);
    }
  });

  it("says the mode is unknown when /health is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    render(<DemoBanner />);
    expect(await screen.findByText(/Provider mode unknown/)).toBeInTheDocument();
  });

  it("treats a non-ok health response as unknown", async () => {
    mockHealth({}, false);
    render(<DemoBanner />);
    expect(await screen.findByText(/Provider mode unknown/)).toBeInTheDocument();
  });
});
