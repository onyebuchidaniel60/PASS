import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import {
  createDb,
  passes,
  profiles,
  runMigrations,
  users,
  type DbHandle,
} from "@pass/db";
import { MockEthos, MockHyperliquid, type XPort } from "@pass/integrations";
import type { ApiEnv } from "@pass/contracts";
import { buildApp } from "../app.js";
import type { AppContext } from "../context.js";
import { loadEnv, resetEnv } from "../env.js";
import { createLogger } from "../logger.js";

/**
 * Public global search: traders by slug/name, Passes by asset/publicId,
 * case-insensitive, capped at five each, drafts excluded.
 */

function stubX(): XPort {
  return {
    mode: "mock",
    resolveIdentity: async () => null,
    getAuthenticatedUser: async () => {
      throw new Error("not under test");
    },
    createPost: async () => {
      throw new Error("not under test");
    },
    buildAuthorizationUrl: () => "https://x.test/authorize",
  };
}

let app: FastifyInstance;
let handle: DbHandle;
let db: DbHandle["db"];
let n = 0;

async function mkTrader(
  slug: string,
  name: string,
  handleName = slug,
): Promise<string> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(profiles).values({
    userId: user.id,
    slug,
    handle: handleName,
    name,
    bio: "search fixture",
  });
  return user.id;
}

async function mkPass(
  traderId: string,
  publicId: string,
  asset: string,
  status: "active" | "draft",
  publishedAt: Date | null,
): Promise<void> {
  n += 1;
  await db.insert(passes).values({
    publicId,
    traderId,
    slug: `search-${n}`,
    version: 1,
    asset,
    direction: "long",
    entryType: "limit",
    entryPrice: "100",
    stopLoss: "95",
    takeProfit: "110",
    leverage: "5",
    thesis: "search fixture",
    status,
    publishedAt,
  });
}

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-search";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-search-test-"));
  handle = await createDb({ pglitePath: dir });
  await runMigrations(handle);
  db = handle.db;

  const ctx: AppContext = {
    env,
    db,
    handle,
    adapters: {
      hyperliquid: new MockHyperliquid(),
      ethos: new MockEthos(),
      x: stubX(),
      modes: {
        hyperliquid: "mock",
        hyperliquidReads: "mock",
        hyperliquidExecution: "mock",
        ethos: "mock",
        x: "mock",
        database: "mock",
      },
    },
    log: createLogger("test"),
    demoMode: false,
    close: handle.close,
  };
  app = await buildApp(ctx);

  const alpha = await mkTrader("alphatrader", "Alpha Trader");
  const btcWhale = await mkTrader("btcwhale", "BTC Whale");
  for (let i = 0; i < 5; i += 1) {
    await mkTrader(`trader${i}`, `Trader ${i}`);
  }
  const now = Date.now();
  for (let i = 1; i <= 6; i += 1) {
    await mkPass(
      btcWhale,
      `SRCH0${i}`,
      "BTC",
      "active",
      new Date(now - i * 60_000),
    );
  }
  await mkPass(alpha, "ETHP01", "ETH", "active", new Date(now - 60_000));
  await mkPass(alpha, "DRAFT1", "BTC", "draft", null);
}, 300_000);

afterAll(async () => {
  await app.close();
  await handle.close();
});

describe("GET /api/v1/search", () => {
  it("returns traders by name and Passes by asset, case-insensitively", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=btc" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      query: string;
      traders: Array<{ slug: string }>;
      passes: Array<{ publicId: string; asset: string; trader: { slug: string } }>;
    };
    expect(body.query).toBe("btc");
    expect(body.traders).toEqual([
      expect.objectContaining({ slug: "btcwhale", displayName: "BTC Whale" }),
    ]);
    expect(body.passes).toHaveLength(5);
    expect(body.passes.every((pass) => pass.asset === "BTC")).toBe(true);
    expect(body.passes[0]).toMatchObject({
      publicId: "SRCH01",
      trader: { slug: "btcwhale" },
    });
  });

  it("returns a Pass by public id and a trader by slug fragment", async () => {
    const passRes = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=SRCH03",
    });
    expect(passRes.statusCode).toBe(200);
    expect(passRes.json()).toMatchObject({
      traders: [],
      passes: [{ publicId: "SRCH03", asset: "BTC" }],
    });

    const traderRes = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=ALPHA",
    });
    expect(traderRes.statusCode).toBe(200);
    expect(traderRes.json()).toMatchObject({
      traders: [{ slug: "alphatrader" }],
      passes: [],
    });
  });

  it("caps each category at five", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/search?q=trader" });
    const body = res.json() as { traders: unknown[] };
    expect(body.traders).toHaveLength(5);
  });

  it("never returns a draft Pass", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=DRAFT1",
    });
    expect(res.json()).toMatchObject({ passes: [] });
  });

  it("returns a clean empty result for no match", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=zzzz-no-match",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      query: "zzzz-no-match",
      traders: [],
      passes: [],
    });
  });
});
