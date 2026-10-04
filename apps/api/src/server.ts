import { createContext } from "./context.js";
import { loadEnv } from "./env.js";
import { createLogger } from "./logger.js";
import { buildApp } from "./app.js";
import { describeSchedules, startScheduler } from "@pass/worker";

const env = loadEnv();
const log = createLogger("server");

async function main() {
  const ctx = await createContext(env, log);
  const app = await buildApp(ctx);

  /**
   * MVP hosting model (docs/DECISIONS.md D-020): the worker's jobs run
   * in-process here rather than as a separate Railway service. Gated behind
   * ENABLE_JOBS so tests and local development never start them implicitly.
   */
  const scheduler = env.ENABLE_JOBS
    ? startScheduler({
        handle: ctx.handle,
        adapters: ctx.adapters,
        log: (level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) =>
          log[level](msg, data),
      })
    : null;

  if (scheduler) {
    log.info("jobs enabled (in-process scheduler)", { schedules: describeSchedules() });
  }

  const shutdown = async (signal: string) => {
    log.info(`received ${signal}, shutting down`);
    // Drain in-flight jobs before the server and database close.
    await scheduler?.stop();
    await app.close();
    await ctx.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: env.PORT, host: env.HOST });
  log.info(`API listening on ${env.HOST}:${env.PORT}`, {
    modes: ctx.adapters.modes,
    db: ctx.env.DATABASE_URL ? "postgres" : "pglite",
    jobs: env.ENABLE_JOBS,
  });
}

main().catch((err) => {
  log.error("fatal startup error", {
    reason: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});