import { ApiEnvSchema } from "@pass/contracts";
import { createDb, runMigrations } from "@pass/db";
import { createAdapters } from "@pass/integrations";
import { describeSchedules, startScheduler } from "./index.js";

/**
 * Standalone worker entry point.
 *
 * NOT used by the MVP deployment: jobs run in-process on the API per
 * docs/DECISIONS.md D-020. This file is retained deliberately so that the
 * future split is a deployment change, not a code rewrite. It only runs when
 * executed directly, so importing the package never starts a scheduler.
 */

const env = ApiEnvSchema.parse(process.env);
const log = (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, scope: "worker", msg, ...(data ?? {}) }));

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].includes("worker");

async function main() {
  const handle = await createDb({
    databaseUrl: env.DATABASE_URL,
    pglitePath: env.DATABASE_PGLITE_PATH,
  });
  await runMigrations(handle, (m) => log("info", m));

  const adapters = createAdapters(env, (m) => log("warn", m));
  const scheduler = startScheduler({ handle, adapters, log });
  log("info", "standalone worker started", {
    modes: adapters.modes,
    schedules: describeSchedules(),
  });

  const stop = async (signal: string) => {
    log("info", `received ${signal}, draining`);
    await scheduler.stop();
    await handle.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));

  // Keep the process alive for the timers.
  await new Promise(() => {});
}

if (invokedDirectly) {
  main().catch((err) => {
    log("error", "fatal worker error", {
      reason: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
}