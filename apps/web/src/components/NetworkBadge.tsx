"use client";

import { useEffect, useState } from "react";
import { clientGet } from "@/lib/client";

/**
 * High-visibility network status badge.
 *
 * The venue is read from GET /health — the server's own config — so the badge
 * follows the deployment rather than a build-time label. Mainnet gets the
 * green heartbeat dot; testnet keeps amber. The dot is aria-hidden because the
 * visible words already carry the state, and role="status" gives the whole
 * badge a stable accessible name.
 */

interface Health {
  hyperliquidVenue?: string | null;
}

export type NetworkBadgeVariant = "compact" | "large";

function labelFor(venue: string | null): {
  label: string;
  network: string;
  tone: "mainnet" | "testnet" | "unknown";
} {
  if (venue === "mainnet") {
    return { label: "Hyperliquid Mainnet", network: "Mainnet", tone: "mainnet" };
  }
  if (venue === "testnet") {
    return { label: "Hyperliquid Testnet", network: "Testnet", tone: "testnet" };
  }
  return { label: "Network status unknown", network: "Unknown", tone: "unknown" };
}

export function NetworkBadge({
  variant = "compact",
  detail,
}: {
  variant?: NetworkBadgeVariant;
  /** Optional second line used by the large Trading-tab treatment. */
  detail?: string;
}) {
  const [venue, setVenue] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const health = await clientGet<Health>("/health");
        if (live) setVenue(health?.hyperliquidVenue ?? null);
      } catch {
        if (live) setVenue(null);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const meta = labelFor(venue);
  return (
    <span
      className="pass-network-badge"
      data-variant={variant}
      data-tone={meta.tone}
      role="status"
      aria-label={`Network: ${meta.network}`}
    >
      <span className="pass-network-badge-dot" aria-hidden="true" />
      <span className="pass-network-badge-copy">
        <span className="pass-network-badge-label">{meta.label}</span>
        {detail ? <span className="pass-network-badge-detail">{detail}</span> : null}
      </span>
    </span>
  );
}
