/**
 * Seed test Passes for the operator Take walk.
 *
 * Creates (or reuses) one seed user — profile slug `passtest` — and three
 * ACTIVE passes owned by it (TEST01 BTC long, TEST02 ETH long, TEST03 SOL
 * short), each with a v1 snapshot and created/published events. The
 * operator cannot take their own Pass, so these exist purely as Take
 * targets from a different account.
 *
 * Repeatable: existing rows are updated back to the spec (active,
 * published, expiry 30d out), never duplicated.
 *
 * Usage:
 *   DATABASE_URL=<postgres-url> node scripts/seed-test-passes.mjs
 *   railway run --service pass-api -- node scripts/seed-test-passes.mjs
 *
 * Only touches users/profiles/passes/pass_versions/pass_events for the
 * seed account. No executions, no wallets, no flags.
 */

import { createRequire } from "node:module";
import { join } from "node:path";

// postgres-js is a dependency of @pass/db, symlinked at
// <repo>/packages/db/node_modules/postgres (pnpm isolated layout).
// Resolve it from the repo root (the cwd this script is run from) so the
// script runs with plain `node`, locally or over ssh.
const requireDb = createRequire(join(process.cwd(), "packages", "db", "package.json"));
const postgres = requireDb("postgres");

const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Refusing to guess a target.");
  process.exit(1);
}

const INFO_URL =
  process.env.HYPERLIQUID_INFO_URL ?? "https://api.hyperliquid-testnet.xyz/info";
const WEB_URL = (process.env.PASS_WEB_URL ?? "https://pass-web-dun.vercel.app").replace(
  /\/$/,
  "",
);

const SPECS = [
  { publicId: "TEST01", asset: "BTC", direction: "long", slug: "seed-btc-long" },
  { publicId: "TEST02", asset: "ETH", direction: "long", slug: "seed-eth-long" },
  { publicId: "TEST03", asset: "SOL", direction: "short", slug: "seed-sol-short" },
];

const FALLBACK_MID = { BTC: "110000", ETH: "4000", SOL: "200" };

async function fetchMids() {
  try {
    const res = await fetch(INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    });
    if (!res.ok) return null;
    return (await res.json()) ?? null;
  } catch {
    return null;
  }
}

function round2(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  // Seed user: reuse by profile slug so re-runs never duplicate.
  let userRows =
    await sql`SELECT u.id FROM users u JOIN profiles p ON p.user_id = u.id WHERE p.slug = 'passtest' LIMIT 1`;
  let userId = userRows[0]?.id ?? null;
  if (!userId) {
    const u = await sql`INSERT INTO users DEFAULT VALUES RETURNING id`;
    userId = u[0].id;
    await sql`INSERT INTO profiles (user_id, slug, handle, name, bio)
              VALUES (${userId}, 'passtest', 'passtest', 'PASS Test', 'Seed account for Take testing.')`;
    console.log(`seed user created (${userId})`);
  } else {
    console.log(`seed user reused (${userId})`);
  }

  const mids = await fetchMids();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const spec of SPECS) {
    const midRaw = mids?.[spec.asset] ?? FALLBACK_MID[spec.asset];
    const mid = Number(midRaw);
    const tp = spec.direction === "long" ? round2(mid * 1.02) : round2(mid * 0.98);
    const sl = spec.direction === "long" ? round2(mid * 0.98) : round2(mid * 1.02);
    const snapshot = {
      asset: spec.asset,
      dex: null,
      direction: spec.direction,
      entryType: "market",
      entryPrice: null,
      stopLoss: sl,
      takeProfit: tp,
      leverage: "3",
      expiresAt: expiresAt.toISOString(),
    };

    const existing =
      await sql`SELECT id, status FROM passes WHERE public_id = ${spec.publicId} LIMIT 1`;
    let passId;
    if (existing[0]) {
      passId = existing[0].id;
      await sql`UPDATE passes SET
                  trader_id = ${userId},
                  slug = ${spec.slug},
                  version = 1,
                  asset = ${spec.asset},
                  direction = ${spec.direction}::direction,
                  entry_type = 'market'::entry_type,
                  entry_price = NULL,
                  stop_loss = ${sl},
                  take_profit = ${tp},
                  leverage = '3',
                  thesis = 'seed pass',
                  status = 'active'::pass_status,
                  expires_at = ${expiresAt},
                  published_at = COALESCE(published_at, ${now}),
                  updated_at = ${now}
                WHERE id = ${passId}`;
    } else {
      const ins = await sql`INSERT INTO passes
        (public_id, trader_id, slug, version, asset, direction, entry_type,
         stop_loss, take_profit, leverage, thesis, status, expires_at, published_at)
        VALUES (${spec.publicId}, ${userId}, ${spec.slug}, 1, ${spec.asset},
          ${spec.direction}::direction, 'market'::entry_type,
          ${sl}, ${tp}, '3', 'seed pass', 'active'::pass_status,
          ${expiresAt}, ${now})
        RETURNING id`;
      passId = ins[0].id;
    }

    await sql`INSERT INTO pass_versions (pass_id, version, snapshot, created_by)
              VALUES (${passId}, 1, ${JSON.stringify(snapshot)}::jsonb, ${userId})
              ON CONFLICT DO NOTHING`;
    const evts =
      await sql`SELECT event_type FROM pass_events WHERE pass_id = ${passId}`;
    const have = new Set(evts.map((e) => e.event_type));
    if (!have.has("created")) {
      await sql`INSERT INTO pass_events (pass_id, pass_version, event_type, actor_user_id, metadata)
                VALUES (${passId}, 1, 'created', ${userId}, '{"seed":true}'::jsonb)`;
    }
    if (!have.has("published")) {
      await sql`INSERT INTO pass_events (pass_id, pass_version, event_type, actor_user_id, metadata)
                VALUES (${passId}, 1, 'published', ${userId}, '{"seed":true}'::jsonb)`;
    }
    console.log(
      `${spec.publicId}: ${spec.asset} ${spec.direction} market 3x TP ${tp} SL ${sl} -> ${WEB_URL}/p/${spec.publicId}`,
    );
  }
} finally {
  await sql.end({ timeout: 5 });
}
