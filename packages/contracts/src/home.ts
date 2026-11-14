import { z } from "zod";

import {
  IsoDateTime,
  PassDirection,
  PassStatus,
  PublicId,
} from "./common.js";

/**
 * Public homepage feed.
 *
 * The homepage is a read-only projection over public Passes and executions.
 * It never carries wallet addresses, order payloads, or account-level
 * Hyperliquid figures. Performance here is the same PASS-owned aggregation the
 * profile page uses: TP / completed executions and realized PnL on closed
 * executions, never a merged trust score (D-007, D-014).
 */

export const HomeTraderDto = z.object({
  slug: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  publishedPasses: z.number().int().nonnegative(),
  activePasses: z.number().int().nonnegative(),
  completedExecutions: z.number().int().nonnegative(),
  /** TP / completed executions, as a percentage. Null when nothing completed. */
  winRatePct: z.number().nullable(),
  /** Realized PnL over the collateral deployed in those closed executions. */
  pnlPct: z.number().nullable(),
  /** Sum of realized PnL on closed executions, as a decimal string. */
  pnlUsd: z.string().nullable(),
  /** Cumulative realized PnL, oldest first, for the mini chart. */
  sparkline: z.array(z.number()),
});
export type HomeTraderDto = z.infer<typeof HomeTraderDto>;

export const HomeActivityDto = z.object({
  id: z.string(),
  kind: z.enum(["execution", "published"]),
  actor: z.object({
    slug: z.string(),
    handle: z.string().nullable(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  pass: z.object({
    publicId: PublicId,
    asset: z.string(),
    direction: PassDirection,
    status: PassStatus,
  }),
  at: IsoDateTime,
  /** Collateral the taker committed, when this row is an execution. */
  sizeUsd: z.string().nullable(),
  /** Realized PnL, when this row is a closed execution. */
  pnlUsd: z.string().nullable(),
});
export type HomeActivityDto = z.infer<typeof HomeActivityDto>;

export const HomeDto = z.object({
  demoMode: z.boolean(),
  topTraders: z.array(HomeTraderDto),
  activity: z.array(HomeActivityDto),
});
export type HomeDto = z.infer<typeof HomeDto>;
