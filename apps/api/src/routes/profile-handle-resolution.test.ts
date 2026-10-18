import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { identities, profiles, users, createDb, runMigrations, type DbHandle } from "@pass/db";
import { MockEthos, MockHyperliquid, type XPort } from "@pass/integrations";
import type { ApiEnv } from "@pass/contracts";
import { buildApp } from "../app.js";
import type { AppContext } from "../context.js";
import { loadEnv, resetEnv } from "../env.js";
import { createLogger } from "../logger.js";

/**
 * An X handle and a PASS slug are chosen independently and can differ, so a
 * handle read off x.com is not necessarily a slug. Both public read paths the
 * extension uses must resolve the handle to the owning profile instead of 404.
 *
 * Exact slug wins over another trader's handle, so a slug can never be
 * shadowed by a colliding handle.
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

async function mkTrader(slug: string, xHandle: string): Promise<void> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(profiles).values({
    userId: user.id,
    slug,
    name: `Trader ${slug}`,
    bio: "bio",
    handle: xHandle,
  });
  await db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: `x_${xHandle.toLowerCase()}`,
    username: xHandle,
    displayName: `Trader ${slug}`,
    avatarUrl: null,
  });
}

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-handle-resolution";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-handle-resolution-test-"));
  handle = await createDb({ pglitePath: dir });
  await runMigrations(handle);
  db = handle.db;

  // Handle differs from slug, in both letter case directions.
  await mkTrader("alexcarbon", "TurnTTFup99");
  // Owns an X handle that collides with the first trader's slug.
  await mkTrader("someoneelse", "alexcarbon");

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
}, 300_000);

afterAll(async () => {
  await app.close();
  await handle.close();
});

describe("X handle resolves to the owning PASS profile", () => {
  it("GET /profiles/:handle resolves via the X username", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/profiles/TurnTTFup99" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      slug: "alexcarbon",
      displayName: "Trader alexcarbon",
    });
  });

  it("resolves an X handle case-insensitively", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/profiles/turnttfup99" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ slug: "alexcarbon" });
  });

  it("prefers an exact slug match over a colliding X handle", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/profiles/alexcarbon" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      slug: "alexcarbon",
      displayName: "Trader alexcarbon",
    });
  });

  it("extension context resolves via the X username", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/extension/context?handle=TurnTTFup99",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      found: true,
      displayName: "Trader alexcarbon",
      xHandle: "TurnTTFup99",
    });
  });

  it("strips a leading @ from the handle", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/extension/context?handle=%40TurnTTFup99",
    });
    expect(res.json()).toMatchObject({ found: true, xHandle: "TurnTTFup99" });
  });

  it("404s an unknown handle instead of returning another profile", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/profiles/nobody-here" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: "PROFILE_NOT_FOUND" } });
  });

  it("reports not_on_pass for an unknown handle", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/extension/context?handle=nobody-here",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ found: false, reason: "not_on_pass" });
  });
});