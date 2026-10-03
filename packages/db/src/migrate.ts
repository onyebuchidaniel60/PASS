import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DbHandle } from "./client.js";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

/**
 * Deterministic, version-controlled migrations
 * (docs/DEPLOYMENT_OPERATIONS.md §7). Applied files are recorded so re-running
 * is a no-op. Runs identically against PostgreSQL and PGlite.
 */
export async function runMigrations(
  handle: DbHandle,
  log: (msg: string) => void = () => {},
): Promise<string[]> {
  await handle.raw(`
    CREATE TABLE IF NOT EXISTS __pass_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await handle.rawQuery("SELECT name FROM __pass_migrations;");
  const applied = new Set(rows.map((r) => String(r.name)));

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    await handle.raw(sql);
    await handle.raw(
      `INSERT INTO __pass_migrations (name) VALUES ('${file.replace(/'/g, "''")}') ON CONFLICT (name) DO NOTHING;`,
    );
    ran.push(file);
    log(`Applied migration ${file}`);
  }

  if (ran.length === 0) log("No pending migrations.");
  return ran;
}