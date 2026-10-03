import { createContext } from "./context.js";
import { loadEnv } from "./env.js";
import { createLogger } from "./logger.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const log = createLogger("server");

async function main() {
  const ctx = await createContext(env, log);
  const app = await buildApp(ctx);

  const shutdown = async (signal: string) => {
    log.info(`received ${signal}, shutting down`);
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
  });
}

main().catch((err) => {
  log.error("fatal startup error", {
    reason: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});