import type { AppContext } from "../context.js";

/**
 * Venue is a PASS concept, not a provider concept: it names which Hyperliquid
 * deployment the server signs and reads against. Kept in one module so
 * market configuration, /health and approval gating cannot disagree.
 */
export type Venue = "mainnet" | "testnet" | "mock";

/**
 * The venue actions are recorded against right now. Mock writes are never a
 * real venue: an approval the mock relay "accepted" was sent nowhere, so it
 * must never present as valid on a live venue later.
 *
 * Mainnet is only reachable when execution is explicitly wired to a non-testnet
 * exchange URL; nothing in this module enables it.
 */
export function currentVenue(ctx: AppContext): Venue {
  if (ctx.adapters.modes.hyperliquidExecution !== "live") return "mock";
  return /testnet/i.test(ctx.env.HYPERLIQUID_EXCHANGE_URL ?? "") ? "testnet" : "mainnet";
}
