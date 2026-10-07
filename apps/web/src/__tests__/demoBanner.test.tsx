import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DemoBanner } from "../components/DemoBanner";

/**
 * The banner previously rendered unconditionally and claimed "provider
 * integrations are running in mock mode". Once Ethos and Hyperliquid reads went
 * live that sentence was simply false, and it said nothing about the surface
 * that still mattered: order execution.
 *
 * The rule that matters most is the last one: the banner must never let a
 * reader conclude that taking a Pass is real while execution is mock.
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
    // Otherwise every screen load flashes "demo mode", including on a fully
    // live deployment.
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const { container } = render(<DemoBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when every surface is live", async () => {
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
    expect(container).toBeEmptyDOMElement();
  });

  it("names the simulated surfaces when reads are live but execution is not", async () => {
    // This is the current production state.
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
    // Live surfaces are NOT named as simulated.
    expect(banner.textContent).not.toMatch(/simulated[^.]*market data/i);
    expect(banner.textContent).not.toMatch(/simulated[^.]*ethos/i);
    // The mock ones are.
    expect(banner.textContent).toMatch(/order execution/);
    expect(banner.textContent).toMatch(/\bx identity\b/);
  });

  it("says the deployment is partly live, not fully demo", async () => {
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
    expect(banner.textContent).not.toMatch(/Demo mode\./);
  });

  it("states plainly that taking a Pass is simulated", async () => {
    mockHealth({
      modes: { hyperliquidReads: "live", hyperliquidExecution: "mock", ethos: "live", x: "mock" },
    });
    render(<DemoBanner />);
    // The single most important sentence on the screen: a reader must never
    // think a Take would move real money.
    expect(await screen.findByText(/taking a Pass is simulated/i)).toBeInTheDocument();
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
    expect(screen.queryByText(/taking a Pass is simulated/i)).toBeNull();
    // Ethos alone is still demo, so the banner stays.
    expect(screen.getByRole("status").textContent).toMatch(/ethos reputation/);
  });

  it("falls back to the combined hyperliquid flag when reads are absent", async () => {
    // Older API builds only report `hyperliquid`.
    mockHealth({ modes: { hyperliquid: "mock", ethos: "mock", x: "mock" } });
    render(<DemoBanner />);
    const banner = await screen.findByRole("status");
    expect(banner.textContent).toMatch(/Demo mode\./);
    expect(banner.textContent).toMatch(/order execution/);
    expect(banner.textContent).toMatch(/market data/);
  });

  it("says the mode is unknown when /health is unreachable", async () => {
    // Claiming "live" after a failed fetch would be the dangerous lie, and
    // claiming "demo" would be untrue. Only "unknown" is honest.
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