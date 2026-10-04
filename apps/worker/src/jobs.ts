import type { DbHandle } from "@pass/db";
import type { Adapters } from "@pass/integrations";

/**
 * Pure job functions.
 *
 * These are exported from the @pass/worker package and called by the API's
 * in-process scheduler on the MVP (docs/DECISIONS.md D-020). They contain no
 * process lifecycle, no CLI entry point, and no shared mutable state, so the
 * future split into a standalone worker service is a deployment change only.
 *
 * Every job is idempotent and safe to retry
 * (docs/DEPLOYMENT_OPERATIONS.md §11).
 */

export interface JobDeps {
  handle: DbHandle;
  adapters: Adapters;
  log: (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) => void;
}

export interface JobResult {
  name: string;
  ok: boolean;
  affected: number;
  durationMs: number;
}

/**
 * Expires Passes whose expiry has elapsed and writes an event for each.
 * Terminal states are never reopened.
 */
export async function expirePasses(deps: JobDeps): Promise<number> {
  const { and, eq, isNotNull, lt } = await import("drizzle-orm");
  const { passes, passEvents } = await import("@pass/db");

  const now = new Date();
  const due = await deps.handle.db
    .select()
    .from(passes)
    .where(and(isNotNull(passes.expiresAt), lt(passes.expiresAt, now), eq(passes.status, "active")));

  for (const p of due) {
    await deps.handle.db
      .update(passes)
      .set({ status: "expired", updatedAt: now })
      .where(eq(passes.id, p.id));
    await deps.handle.db.insert(passEvents).values({
      passId: p.id,
      passVersion: p.version,
      eventType: "expired",
      metadata: { reason: "expiry_elapsed", expiresAt: p.expiresAt?.toISOString() },
    });
  }
  return due.length;
}

/**
 * Reconciles provider order status for executions that never received a fill
 * price. Failures are logged per execution and never abort the batch.
 */
export async function reconcileExecutions(deps: JobDeps): Promise<number> {
  const { eq, isNull } = await import("drizzle-orm");
  const { executions } = await import("@pass/db");

  const pending = await deps.handle.db
    .select()
    .from(executions)
    .where(isNull(executions.actualEntry));

  let reconciled = 0;
  for (const e of pending) {
    if (!e.providerOrderId) continue;
    try {
      const status = await deps.adapters.hyperliquid.getOrderStatus(e.providerOrderId);
      if (!status) continue;
      await deps.handle.db
        .update(executions)
        .set({
          providerStatus: status.status,
          actualEntry: status.avgPx,
          openedAt: status.status === "filled" ? new Date() : e.openedAt,
          updatedAt: new Date(),
        })
        .where(eq(executions.id, e.id));
      reconciled += 1;
    } catch (err) {
      deps.log("warn", "execution reconcile failed", {
        executionId: e.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return reconciled;
}

/** Refreshes cached Ethos reputation snapshots that have gone stale. */
export async function refreshEthosProfiles(deps: JobDeps): Promise<number> {
  const { lt, isNotNull } = await import("drizzle-orm");
  const { ethosProfiles } = await import("@pass/db");

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stale = await deps.handle.db
    .select()
    .from(ethosProfiles)
    .where(lt(ethosProfiles.syncedAt, cutoff));

  let refreshed = 0;
  for (const p of stale) {
    const ref = p.providerProfileId;
    if (!ref) continue;
    try {
      const rep = await deps.adapters.ethos.getReputation(ref);
      if (!rep) continue;
      const { eq } = await import("drizzle-orm");
      await deps.handle.db
        .update(ethosProfiles)
        .set({
          credibilityScore:
            rep.credibilityScore === null || rep.credibilityScore === undefined
              ? null
              : String(rep.credibilityScore),
          reviewsCount: rep.reviewsCount,
          vouchesCount: rep.vouchesCount,
          humanVerified: rep.humanVerified,
          sourceUrl: rep.sourceUrl,
          syncedAt: new Date(),
        })
        .where(eq(ethosProfiles.userId, p.userId));
      refreshed += 1;
    } catch (err) {
      deps.log("warn", "ethos refresh failed", {
        userId: p.userId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  void isNotNull;
  return refreshed;
}

/** Removes expired OAuth state/PKCE artifacts. */
export async function cleanupStaleOauthState(deps: JobDeps): Promise<number> {
  const { lt } = await import("drizzle-orm");
  const { oauthStates } = await import("@pass/db");
  const rows = await deps.handle.db
    .delete(oauthStates)
    .where(lt(oauthStates.expiresAt, new Date()))
    .returning({ id: oauthStates.state });
  return rows.length;
}

export const JOBS = [
  { name: "expire-passes", run: expirePasses, everyMs: 60_000 },
  { name: "reconcile-executions", run: reconcileExecutions, everyMs: 120_000 },
  { name: "refresh-ethos", run: refreshEthosProfiles, everyMs: 6 * 60 * 60 * 1000 },
  { name: "cleanup-oauth-state", run: cleanupStaleOauthState, everyMs: 15 * 60 * 1000 },
] as const;

export type JobName = (typeof JOBS)[number]["name"];