import { createDb } from "./client.js";

/**
 * Verifies the D-018 schema invariants are actually present in the database,
 * rather than merely documented.
 */
const handle = await createDb({
  databaseUrl: process.env.DATABASE_URL,
  pglitePath: process.env.DATABASE_PGLITE_PATH ?? "./.pglite",
});

const expected = [
  "passes_trader_slug_idx",
  "passes_public_id_idx",
  "pass_versions_pass_version_idx",
  "executions_taker_created_idx",
  "identities_provider_subject_idx",
];

try {
  const { rows } = await handle.rawQuery(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public';",
  );
  const found = new Set(rows.map((r) => String(r.indexname)));
  let bad = 0;
  for (const name of expected) {
    const ok = found.has(name);
    if (!ok) bad += 1;
    console.log(`${ok ? "OK  " : "FAIL"}  index ${name}`);
  }

  const tables = await handle.rawQuery(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
  );
  const tableNames = tables.rows.map((r) => String(r.tablename)).sort();
  console.log("OK    tables:", tableNames.join(", "));

  process.exitCode = bad === 0 ? 0 : 1;
} finally {
  await handle.close();
}