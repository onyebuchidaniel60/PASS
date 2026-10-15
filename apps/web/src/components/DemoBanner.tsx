"use client";

import { useEffect, useState } from "react";

/**
 * Venue + provider-mode banner — accurate about WHICH surfaces are live.
 *
 * The banner this replaces was unconditional and read "provider integrations
 * are running in mock mode". Once Ethos and Hyperliquid reads went live that
 * sentence became false, which is worse than no banner: it tells a reader to
 * distrust prices that are real while telling them nothing about the one thing
 * that matters — order execution.
 *
 * Rules encoded here:
 *  - the venue is ALWAYS named when known ("Hyperliquid Testnet" /
 *    "Hyperliquid Mainnet"): the persistent indicator at the top of the app;
 *  - ALL live            -> venue line only, no mode notes;
 *  - ANY not-live        -> name the surfaces that are not live;
 *  - execution is always named explicitly when it is not live;
 *  - unknown (health unreachable) -> say so;
 *  - no simulation language anywhere: orders execute on Hyperliquid and no
 *    surface is labelled as a demo.
 */

/** The `modes` block of GET /health, plus the venue. */
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
  /** Current venue per the server's own config (testnet/mainnet). */
  hyperliquidVenue?: string | null;
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

function venueLabel(venue: string | null | undefined): string | null {
  if (venue === "testnet") return "Hyperliquid Testnet";
  if (venue === "mainnet") return "Hyperliquid Mainnet";
  return null;
}

export function DemoBanner() {
  // `null` means "not known yet". Rendering a banner before /health answers
  // would assert a mode on every screen load, including a fully live one.
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Stage B: same-origin via the Next rewrite proxy (see next.config.mjs).
    // /health carries no session, but a relative fetch keeps one code path
    // and avoids a second CORS origin.
    fetch("/health", { cache: "no-store" })
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
  const notLive = surfaces.filter((s) => s.mode !== "live");
  const venue = venueLabel(health?.hyperliquidVenue);

  // Everything live: the venue line is the whole banner — the persistent
  // indicator that orders go to Hyperliquid Testnet (or Mainnet).
  if (notLive.length === 0) {
    if (!venue) return null;
    return (
      <div className="pass-demo-banner" role="status">
        <span className="pass-demo-banner-lead">{venue}</span>
      </div>
    );
  }

  return (
    <div className="pass-demo-banner" role="status">
      {venue ? (
        <>
          <span className="pass-demo-banner-lead">{venue}</span>{" "}
        </>
      ) : null}
      <span className="pass-demo-banner-lead">
        {notLive.length === surfaces.length
          ? "Offline mode."
          : "Partly live."}
      </span>{" "}
      <span className="pass-demo-banner-note">
        Not live:{" "}
        {notLive.map((s) => s.label.toLowerCase()).join(", ")}.
      </span>{" "}
      {/* Execution gets its own sentence regardless, because it is the surface
          that moves money. While it is not live, orders are not placed. */}
      {surfaces.some((s) => s.key === "execution" && s.mode !== "live") ? (
        <span className="pass-demo-banner-note">
          Hyperliquid execution is paused in this deployment.
          {surfaces.some((s) => s.key === "reads" && s.mode === "live") ? (
            <> Market data is live.</>
          ) : null}{" "}
          Orders are not placed.
        </span>
      ) : null}
    </div>
  );
}

export default DemoBanner;
