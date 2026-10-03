import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  kind: "postgres" | "pglite";
  /** Executes raw SQL. Used by the migration runner. */
  raw: (sql: string) => Promise<void>;
  /** Executes a raw query and returns rows. */
  rawQuery: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
  close: () => Promise<void>;
}

/**
 * Database access.
 *
 * Production and any environment with DATABASE_URL uses real Postgres via
 * postgres-js. Local development and tests fall back to PGlite, an embedded
 * build of actual PostgreSQL, so the whole stack boots and migrates with no
 * external service and no Docker.
 *
 * The SQL is identical in both cases; only the driver differs.
 */
export async function createDb(opts: {
  databaseUrl?: string | undefined;
  pglitePath?: string | undefined;
  log?: (msg: string) => void;
}): Promise<DbHandle> {
  const log = opts.log ?? (() => {});

  if (opts.databaseUrl) {
    const { default: postgres } = await import("postgres");
    const client = postgres(opts.databaseUrl, {
      max: 10,
      onnotice: () => {},
    });
    const db = drizzlePg(client, { schema });
    return {
      db,
      kind: "postgres",
      raw: async (sql: string) => {
        await client.unsafe(sql);
      },
      rawQuery: async (sql: string) => {
        const res = await client.unsafe(sql);
        return { rows: res as unknown as Array<Record<string, unknown>> };
      },
      close: async () => {
        await client.end({ timeout: 5 });
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const dataDir = opts.pglitePath ?? "./.pglite";
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  log(`Using embedded PGlite database at ${dataDir} (no DATABASE_URL set).`);
  const db = drizzlePglite(pg, { schema }) as unknown as Db;
  return {
    db,
    kind: "pglite",
    raw: async (sql: string) => {
      await pg.exec(sql);
    },
    rawQuery: async (sql: string) => {
      const res = await pg.query(sql);
      return { rows: (res.rows ?? []) as Array<Record<string, unknown>> };
    },
    close: async () => {
      await pg.close();
    },
  };
}

export { schema };