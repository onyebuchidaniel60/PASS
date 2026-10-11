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
 *
 * Stage G (mock): rows with `simulated: true` never touch Hyperliquid —
 * neither the Exchange API (no writes, ever) nor the Info order-status
 * read (a `mock_` id is not a real oid). They close deterministically
 * against the live mid and their referenced Pass-version snapshot (see
 * `closeSimulatedExecution`). Real rows (`simulated: false`) keep the
 * existing Hyperliquid path below, byte for byte.
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
    if (e.simulated) {
      reconciled += await closeSimulatedExecution(deps, e.id);
      continue;
    }
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

/**
 * Stage G (mock): deterministically closes one simulated execution.
 *
 * Reads the authored bracket (direction, entry, TP, SL) from the
 * `pass_versions` snapshot the execution references (D-018.5 — never the
 * live `passes` row), reads the current mid through the live Info API
 * (a read, not a write; D-021), and closes on the first leg the mid
 * reaches. No order-status lookup, no Exchange call: a `mock_` id is not
 * a real oid and mock mode must never place or query orders as if it
 * were. Returns 1 when the row closed, 0 when it stays open.
 */
export async function closeSimulatedExecution(
  deps: JobDeps,
  executionId: string,
): Promise<number> {
  const { and, eq } = await import("drizzle-orm");
  const { executions, passes, passVersions } = await import("@pass/db");
  const { decideSimulatedClose, simulatedClosePnl } = await import("@pass/domain");

  const found = await deps.handle.db
    .select()
    .from(executions)
    .where(eq(executions.id, executionId))
    .limit(1);
  const e = found[0];
  // Only open simulated rows close here. Real rows and already-closed
  // rows are never touched by this branch.
  if (!e || !e.simulated || e.actualEntry !== null) return 0;

  const passRows = await deps.handle.db
    .select()
    .from(passes)
    .where(eq(passes.id, e.passId))
    .limit(1);
  const pass = passRows[0];
  if (!pass) return 0;

  const versionRows = await deps.handle.db
    .select()
    .from(passVersions)
    .where(and(eq(passVersions.passId, e.passId), eq(passVersions.version, e.passVersion)))
    .limit(1);
  const snapshot = (versionRows[0]?.snapshot ?? {}) as {
    direction?: unknown;
    entryPrice?: string | null;
    takeProfit?: string | null;
    stopLoss?: string | null;
  };
  if (snapshot.direction !== "long" && snapshot.direction !== "short") return 0;

  let mid: string | null = null;
  try {
    const snap = await deps.adapters.hyperliquid.getSnapshot(pass.asset);
    mid = snap?.midPrice ?? snap?.markPrice ?? null;
  } catch (err) {
    deps.log("warn", "simulated close skipped: no market reading", {
      executionId: e.id,
      reason: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }

  const outcome = decideSimulatedClose(
    {
      direction: snapshot.direction,
      entryPrice: snapshot.entryPrice ?? null,
      takeProfit: snapshot.takeProfit ?? null,
      stopLoss: snapshot.stopLoss ?? null,
    },
    mid,
  );
  // No leg reached: leave open until one resolves. Never close without
  // a decision.
  if (!outcome) return 0;

  const exitPrice = outcome === "tp_hit" ? (snapshot.takeProfit ?? null) : (snapshot.stopLoss ?? null);
  const pnl = simulatedClosePnl({
    direction: snapshot.direction,
    entryPrice: snapshot.entryPrice ?? null,
    exitPrice,
    baseSize: e.positionSize,
  });

  const now = new Date();
  await deps.handle.db
    .update(executions)
    .set({
      providerStatus: outcome,
      status: outcome,
      actualEntry: exitPrice,
      realizedPnl: pnl,
      fees: "0",
      closedAt: now,
      updatedAt: now,
    })
    .where(eq(executions.id, e.id));

  await transitionPassOnSimulatedClose(deps, {
    passId: e.passId,
    passVersion: e.passVersion,
    outcome,
    executionId: e.id,
    providerOrderId: e.providerOrderId,
    takerUserId: e.takerUserId,
  });

  return 1;
}

/**
 * Stage G (mock): carries a simulated close onto the Pass itself.
 * The first close wins — a Pass already past `active`/`entry_pending`
 * (terminal or otherwise) is never rewritten (DATA_MODEL.md §3.8).
 * Every transition writes its `pass_events` row (D-008, D-018.5).
 */
export async function transitionPassOnSimulatedClose(
  deps: JobDeps,
  close: {
    passId: string;
    passVersion: number;
    outcome: "tp_hit" | "sl_hit";
    executionId: string;
    providerOrderId: string | null;
    takerUserId: string | null;
  },
): Promise<boolean> {
  const { eq } = await import("drizzle-orm");
  const { passes, passEvents } = await import("@pass/db");

  const rows = await deps.handle.db
    .select()
    .from(passes)
    .where(eq(passes.id, close.passId))
    .limit(1);
  const pass = rows[0];
  if (!pass) return false;
  if (pass.status !== "active" && pass.status !== "entry_pending") return false;

  const now = new Date();
  await deps.handle.db
    .update(passes)
    .set({ status: close.outcome, updatedAt: now })
    .where(eq(passes.id, pass.id));
  await deps.handle.db.insert(passEvents).values({
    passId: pass.id,
    passVersion: close.passVersion,
    eventType: close.outcome,
    actorUserId: close.takerUserId,
    metadata: {
      executionId: close.executionId,
      providerOrderId: close.providerOrderId,
      simulated: true,
    },
  });
  return true;
}

/** Refreshes cached Ethos reputation snapshots that have gone stale. */export async function refreshEthosProfiles(deps: JobDeps): Promise<number> {
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