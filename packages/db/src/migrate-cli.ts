import { createDb } from "./client.js";
import { runMigrations } from "./migrate.js";

/**
 * Migration entry point. `pnpm db:migrate` runs this.
 * Uses DATABASE_URL when present, otherwise the embedded PGlite database.
 */
const handle = await createDb({
  databaseUrl: process.env.DATABASE_URL,
  pglitePath: process.env.DATABASE_PGLITE_PATH ?? "./.pglite",
});

try {
  const ran = await runMigrations(handle, (m) => console.log(m));
  console.log(
    ran.length > 0
      ? `Migrations complete (${handle.kind}): applied ${ran.length}.`
      : `Migrations up to date (${handle.kind}).`,
  );
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await handle.close();
}