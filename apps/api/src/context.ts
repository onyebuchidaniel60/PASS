import { createDb, runMigrations, type Db, type DbHandle } from "@pass/db";
import { createAdapters, type Adapters } from "@pass/integrations";
import type { ApiEnv } from "@pass/contracts";
import { createLogger, type Logger } from "./logger.js";

export interface AppContext {
  env: ApiEnv;
  db: Db;
  /** Raw handle, used by the in-process job scheduler (D-020). */
  handle: DbHandle;
  adapters: Adapters;
  log: Logger;
  close: () => Promise<void>;
  /** True when provider data is simulated. Surfaced to the UI as demo mode. */
  demoMode: boolean;
}

export async function createContext(
  env: ApiEnv,
  log: Logger = createLogger("app"),
): Promise<AppContext> {
  const handle: DbHandle = await createDb({
    databaseUrl: env.DATABASE_URL,
    pglitePath: env.DATABASE_PGLITE_PATH ?? "./.pglite",
    log: (m) => log.info(m),
  });

  await runMigrations(handle, (m) => log.info(m));

  const adapters = createAdapters(env, (m) => log.warn(m));

  const demoMode = adapters.modes.hyperliquid === "mock";

  return {
    env,
    db: handle.db,
    handle,
    adapters,
    log,
    demoMode,
    close: handle.close,
  };
}