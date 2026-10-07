"use client";

import { useEffect, useState } from "react";

import { API_URL } from "@/lib/api";

/**
 * Demo-mode banner — accurate about WHICH surfaces are simulated.
 *
 * The banner this replaces was unconditional and read "provider integrations
 * are running in mock mode". Once Ethos and Hyperliquid reads went live that
 * sentence became false, which is worse than no banner: it tells a reader to
 * distrust prices that are real while telling them nothing about the one thing
 * that is still simulated — order execution.
 *
 * Rules encoded here:
 *  - ALL live            -> render nothing.
 *  - ANY mock            -> name the surfaces that are simulated.
 *  - Execution is always named explicitly. Never imply a live execution path
 *    while `hyperliquidExecution` is mock (docs/EXECUTION_READINESS.md).
 *  - Unknown (health unreachable) -> say so. Claiming "live" on a failed fetch
 *    and claiming "demo" are both lies; only the first is dangerous.
 */

/** The `modes` block of GET /health. */
interface HealthModes {
  hyperliquid?: "live" | "mock";
  /** D-021: reads and execution are gated independently. */
  hyperliquidReads?: "live" | "mock";
  hyperliquidExecution?: "live" | "mock";
  ethos?: "live" | "mock";
  x?: "live" | "mock";
  database?: "live" | "mock";
}

interface Health {
  modes: HealthModes;
}

interface Surface {
  key: string;
  label: string;
  mode: "live" | "mock" | "unknown";
  /** Execution is called out because it is the one that moves money. */
  critical?: boolean;
}

function surfacesFrom(modes: HealthModes): Surface[] {
  const m = (v: unknown): "live" | "mock" | "unknown" =>
    v === "live" ? "live" : v === "mock" ? "mock" : "unknown";

  return [
    { key: "reads", label: "Market data", mode: m(modes.hyperliquidReads) },
    {
      key: "execution",
      label: "Order execution",
      mode: m(modes.hyperliquidExecution ?? modes.hyperliquid),
      critical: true,
    },
    { key: "ethos", label: "Ethos reputation", mode: m(modes.ethos) },
    { key: "x", label: "X identity", mode: m(modes.x) },
  ];
}

export function DemoBanner() {
  // `null` means "not known yet". Rendering a banner before /health answers
  // would assert demo mode on every screen load, including a fully live one.
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/health`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: Health) => {
        if (!cancelled) setHealth(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!failed && health === null) return null;

  if (failed) {
    return (
      <div className="pass-demo-banner" role="status">
        <span className="pass-demo-banner-lead">Provider mode unknown.</span>{" "}
        <span className="pass-demo-banner-note">
          PASS could not reach its API to confirm which integrations are live. Treat
          figures on this screen as unverified.
        </span>
      </div>
    );
  }

  const surfaces = surfacesFrom(health?.modes ?? {});
  const demoed = surfaces.filter((s) => s.mode !== "live");

  // Everything live: no banner at all. Anything else gets one.
  if (demoed.length === 0) return null;

  return (
    <div className="pass-demo-banner" role="status">
      <span className="pass-demo-banner-lead">
        {demoed.length === surfaces.length
          ? "Demo mode."
          : "Partly live."}
      </span>{" "}
      <span className="pass-demo-banner-note">
        Simulated — not real data:{" "}
        {demoed.map((s) => s.label.toLowerCase()).join(", ")}.
      </span>{" "}
      {/* Execution gets its own sentence regardless, because it is the surface
          that would move money if it were live. */}
      {surfaces.some((s) => s.key === "execution" && s.mode !== "live") ? (
        <span className="pass-demo-banner-note">
          Orders cannot be placed in this deployment: taking a Pass is simulated.
        </span>
      ) : null}
    </div>
  );
}

export default DemoBanner;