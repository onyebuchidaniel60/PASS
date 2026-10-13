import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  profiles,
  users,
  type DbHandle,
} from "@pass/db";
import type { AppContext } from "../context.js";
import { createPass, publishPass } from "./pass-service.js";

/**
 * Publish INTERNAL_ERROR regression (2026-10-13 production incident).
 *
 * POST /api/v1/passes 500'd with
 *   duplicate key value violates unique constraint "passes_trader_slug_idx"
 * because the Pass slug was derived deterministically from
 * (traderSlug, asset, direction). The second Pass with the same triple —
 * e.g. the operator retrying the same form — collided on the
 * UNIQUE(trader_id, slug) index and surfaced as INTERNAL_ERROR, which the
 * Create Pass client wraps as "Publish failed (INTERNAL_ERROR)".
 *
 * A Trader must be able to author any number of Passes on the same
 * asset+direction over time (D-018.5 history is per-Pass; the slug is only
 * a human-readable convenience per D-018.4).
 */
let handle: DbHandle;
let db: DbHandle["db"];

function ctx(): AppContext {
  return {
    db,
    adapters: {
      // Provider unavailable: createPass must not block authoring on a
      // market-list read (assertSupportedAsset early-returns on throw).
      hyperliquid: {
        listAssets: async () => {
          throw new Error("offline in test");
        },
      },
    },
  } as unknown as AppContext;
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "pass-slug-collision-"));
  handle = await createDb({ pglitePath: dir });
  const { runMigrations } = await import("@pass/db");
  await runMigrations(handle);
  db = handle.db;
}, 180_000);

afterAll(async () => {
  await handle.close();
});

let n = 0;

async function mkTrader(): Promise<string> {
  n += 1;
  const [u] = await db.insert(users).values({}).returning();
  if (!u) throw new Error("fixture setup failed");
  await db.insert(profiles).values({
    userId: u.id,
    slug: `slugt${Date.now().toString(36)}${n}`,
    name: "Slug Trader",
    bio: null,
  });
  return u.id;
}

function plan() {
  return {
    asset: "BTC",
    direction: "long" as const,
    entryType: "limit" as const,
    entryPrice: "60000",
    stopLoss: "59000",
    takeProfit: "62000",
    leverage: "5",
    thesis: "Second BTC long must not collide on slug.",
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

describe("pass slug uniqueness", () => {
  it("two Passes with the same asset+direction both create and publish", async () => {
    const traderId = await mkTrader();

    const first = await createPass(ctx(), traderId, plan());
    const second = await createPass(ctx(), traderId, plan());

    // Same human-readable prefix (D-018.4 convenience), distinct rows.
    expect(second.id).not.toBe(first.id);
    expect(second.slug).not.toBe(first.slug);
    const base = first.slug.slice(0, first.slug.lastIndexOf("-"));
    expect(second.slug.startsWith(`${base}-`)).toBe(true);

    const published = await publishPass(ctx(), second.id, traderId);
    expect(published.status).toBe("active");
    expect(published.publicId).toBe(second.publicId);
  });
});
