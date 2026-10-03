import { ApiEnvSchema } from "@pass/contracts";
import { createDb, runMigrations, type DbHandle } from "@pass/db";
import { createAdapters } from "@pass/integrations";

/**
 * PASS worker.
 *
 * Postgres-backed jobs, no new infrastructure (docs/TECHNICAL_SPEC.md §4,
 * §15). Required jobs:
 *   1. Pass expiry / state reconciliation
 *   2. order / execution reconciliation
 *   3. performance aggregation
 *   4. Ethos profile refresh
 *   5. stale-data cleanup
 *
 * Every job is idempotent and safe to retry (docs/DEPLOYMENT_OPERATIONS.md §11).
 */

const env = ApiEnvSchema.parse(process.env);
const log = (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, scope: "worker", msg, ...(data ?? {}) }));

const TICK_MS = Number(process.env.WORKER_TICK_MS ?? 60_000);

async function jobExpirePasses(handle: DbHandle) {
  const { and, eq, isNotNull, lt } = await import("drizzle-orm");
  const { passes, passEvents } = await import("@pass/db");

  const now = new Date();
  const due = await handle.db
    .select()
    .from(passes)
    .where(
      and(
        isNotNull(passes.expiresAt),
        lt(passes.expiresAt, now),
        eq(passes.status, "active"),
      ),
    );

  for (const p of due) {
    await handle.db
      .update(passes)
      .set({ status: "expired", updatedAt: now })
      .where(eq(passes.id, p.id));
    await handle.db.insert(passEvents).values({
      passId: p.id,
      passVersion: p.version,
      eventType: "expired",
      metadata: { reason: "expiry_elapsed", expiresAt: p.expiresAt?.toISOString() },
    });
  }
  if (due.length > 0) log("info", "expired passes", { count: due.length });
  return due.length;
}

async function jobReconcileExecutions(handle: DbHandle, adapters: ReturnType<typeof createAdapters>) {
  const { eq, isNull } = await import("drizzle-orm");
  const { executions } = await import("@pass/db");

  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const pending = await handle.db
    .select()
    .from(executions)
    .where(isNull(executions.actualEntry));

  let reconciled = 0;
  for (const e of pending) {
    if (!e.providerOrderId) continue;
    if (e.createdAt > cutoff) continue;
    try {
      const status = await adapters.hyperliquid.getOrderStatus(e.providerOrderId);
      if (!status) continue;
      await handle.db
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
      log("warn", "execution reconcile failed", {
        executionId: e.id,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (reconciled > 0) log("info", "reconciled executions", { count: reconciled });
  return reconciled;
}

async function jobCleanupOAuthStates(handle: DbHandle) {
  const { lt } = await import("drizzle-orm");
  const { oauthStates } = await import("@pass/db");
  const rows = await handle.db
    .delete(oauthStates)
    .where(lt(oauthStates.expiresAt, new Date()))
    .returning({ id: oauthStates.state });
  return rows.length;
}

async function main() {
  const handle = await createDb({
    databaseUrl: env.DATABASE_URL,
    pglitePath: env.DATABASE_PGLITE_PATH,
  });
  await runMigrations(handle, (m) => log("info", m));

  const adapters = createAdapters(env, (m) => log("warn", m));
  log("info", "worker started", {
    modes: adapters.modes,
    tickMs: TICK_MS,
    db: env.DATABASE_URL ? "postgres" : "pglite",
  });

  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  while (running) {
    try {
      await jobExpirePasses(handle);
      await jobReconcileExecutions(handle, adapters);
      await jobCleanupOAuthStates(handle);
    } catch (err) {
      log("error", "tick failed", {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }

  await handle.close();
  log("info", "worker stopped");
}

main().catch((err) => {
  log("error", "fatal worker error", {
    reason: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});