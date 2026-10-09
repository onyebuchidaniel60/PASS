import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { count, eq } from "drizzle-orm";
import {
  createDb,
  executions,
  identities,
  passes,
  profiles,
  runMigrations,
  tradingAccounts,
  users,
  xConnections,
  type DbHandle,
} from "@pass/db";
import { MockEthos, MockHyperliquid, type XPort } from "@pass/integrations";
import type { ApiEnv } from "@pass/contracts";
import { buildApp } from "../app.js";
import type { AppContext } from "../context.js";
import { loadEnv, resetEnv } from "../env.js";
import { createLogger } from "../logger.js";
import { SESSION_COOKIE, createSession } from "../plugins/session.js";

/**
 * Auth gates for every authenticated mutation (SECURITY_SPEC.md §10, §11)
 * plus the identity requirement for Pass authoring (PRODUCT_PRD.md §4: a
 * Trader is an identified user — a bare session is not enough to publish).
 *
 * Bug 1: a session WITHOUT an X identity could POST /passes and author a
 * Pass with no author attribution (disconnecting X keeps the PASS session).
 * Bug 1b: POST /passes/:publicId/refresh mutated execution state with no
 * session at all.
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

function ctxish(): AppContext {
  return { db } as unknown as AppContext;
}

async function mkUser(opts: { identity?: boolean; profile?: boolean } = {}): Promise<string> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  if (opts.identity) {
    await db.insert(identities).values({
      userId: user.id,
      provider: "x",
      providerSubjectId: `x-subject-${user.id}`,
      username: "fixturehandle",
      displayName: null,
      avatarUrl: null,
    });
    await db.insert(xConnections).values({
      userId: user.id,
      xUserId: `x-subject-${user.id}`,
      xHandle: "fixturehandle",
    });
  }
  if (opts.profile) {
    await db.insert(profiles).values({
      userId: user.id,
      slug: `trader_${user.id.slice(0, 8)}`,
      name: "Fixture",
      bio: null,
    });
  }
  return user.id;
}

async function cookie(userId: string): Promise<string> {
  return `${SESSION_COOKIE}=${await createSession(ctxish(), userId)}`;
}

const PASS_BODY = {
  asset: "BTC",
  direction: "long",
  entryType: "limit",
  entryPrice: "113400",
  stopLoss: "111900",
  takeProfit: "116000",
  leverage: "5",
  thesis: "BTC reclaiming resistance with increasing volume.",
};

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-pass-gate";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-pass-gate-test-"));
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
}, 300_000);

afterAll(async () => {
  await app.close();
  await handle.close();
});

async function code(res: { statusCode: number; body: string }): Promise<string> {
  return (JSON.parse(res.body) as { error: { code: string } }).error.code;
}

describe("signed-out mutations are rejected", () => {
  const cases: Array<{
    name: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    url: string;
    body?: Record<string, unknown>;
  }> = [
    { name: "POST /passes", method: "POST", url: "/api/v1/passes", body: PASS_BODY },
    {
      name: "PATCH /passes/:id",
      method: "PATCH",
      url: "/api/v1/passes/00000000-0000-0000-0000-000000000000",
      body: {},
    },
    {
      name: "POST publish",
      method: "POST",
      url: "/api/v1/passes/00000000-0000-0000-0000-000000000000/publish",
      body: {},
    },
    {
      name: "POST cancel",
      method: "POST",
      url: "/api/v1/passes/00000000-0000-0000-0000-000000000000/cancel",
      body: {},
    },
    {
      name: "POST execution-preview",
      method: "POST",
      url: "/api/v1/passes/00000000-0000-0000-0000-000000000000/execution-preview",
      body: {},
    },
    {
      name: "POST executions",
      method: "POST",
      url: "/api/v1/passes/00000000-0000-0000-0000-000000000000/executions",
      body: {},
    },
    { name: "POST /profiles", method: "POST", url: "/api/v1/profiles", body: {} },
    { name: "PATCH /profiles/me", method: "PATCH", url: "/api/v1/profiles/me", body: {} },
    {
      name: "POST ethos/refresh",
      method: "POST",
      url: "/api/v1/integrations/ethos/refresh",
      body: {},
    },
    { name: "GET /me", method: "GET", url: "/api/v1/me" },
    { name: "GET /me/passes", method: "GET", url: "/api/v1/me/passes" },
    { name: "GET /me/dashboard", method: "GET", url: "/api/v1/me/dashboard" },
    { name: "GET /me/trading-accounts", method: "GET", url: "/api/v1/me/trading-accounts" },
    { name: "POST /me/trading-accounts", method: "POST", url: "/api/v1/me/trading-accounts", body: {} },
    { name: "GET /me/executions", method: "GET", url: "/api/v1/me/executions" },
    { name: "GET /me/account-state", method: "GET", url: "/api/v1/me/account-state" },
    { name: "POST /sharing/x", method: "POST", url: "/api/v1/sharing/x", body: {} },
    {
      name: "DELETE trading-account",
      method: "DELETE",
      url: "/api/v1/me/trading-accounts/00000000-0000-0000-0000-000000000000",
    },
    { name: "POST passes/:publicId/refresh", method: "POST", url: "/api/v1/passes/nope/refresh" },
  ];
  for (const entry of cases) {
    it(`${entry.name} -> 401 signed out`, async () => {
      const res = await app.inject({
        method: entry.method,
        url: entry.url,
        ...(entry.body === undefined ? {} : { payload: entry.body }),
      });
      expect(res.statusCode).toBe(401);
      expect(await code(res)).toBe("AUTH_REQUIRED");
    });
  }
}, 180_000);

describe("Pass authoring requires an X identity, not just a session", () => {
  it("session without identity -> 409 IDENTITY_NOT_CONNECTED", async () => {
    const userId = await mkUser();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/passes",
      headers: { cookie: await cookie(userId) },
      payload: PASS_BODY,
    });
    expect(res.statusCode).toBe(409);
    expect(await code(res)).toBe("IDENTITY_NOT_CONNECTED");
  });

  it("session with identity and profile -> 201", async () => {
    const userId = await mkUser({ identity: true, profile: true });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/passes",
      headers: { cookie: await cookie(userId) },
      payload: PASS_BODY,
    });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as { publicId?: string }).publicId).toBeTruthy();
  });
}, 180_000);

describe("PASS-side trading-account unlink", () => {
  it("refuses another user's account", async () => {
    const owner = await mkUser();
    const other = await mkUser();
    const [acct] = await db
      .insert(tradingAccounts)
      .values({ userId: owner, provider: "hyperliquid", accountAddress: "0x1111111111111111111111111111111111111111" })
      .returning();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/me/trading-accounts/${acct!.id}`,
      headers: { cookie: await cookie(other) },
    });
    expect(res.statusCode).toBe(403);
  });

  it("deletes the caller's own account", async () => {
    const userId = await mkUser();
    const [acct] = await db
      .insert(tradingAccounts)
      .values({ userId, provider: "hyperliquid", accountAddress: "0x2222222222222222222222222222222222222222" })
      .returning();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/me/trading-accounts/${acct!.id}`,
      headers: { cookie: await cookie(userId) },
    });
    expect(res.statusCode).toBe(200);
    const rows = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, acct!.id));
    expect(rows.length).toBe(0);
  });

  it("refuses an account with executions", async () => {
    const userId = await mkUser({ profile: true });
    const [acct] = await db
      .insert(tradingAccounts)
      .values({ userId, provider: "hyperliquid", accountAddress: "0x3333333333333333333333333333333333333333" })
      .returning();
    const [pass] = await db
      .insert(passes)
      .values({
        publicId: "execguard1",
        traderId: userId,
        slug: "guard-eth-long",
        version: 1,
        asset: "ETH",
        direction: "long",
        entryType: "market",
        thesis: "Guard fixture.",
        status: "active",
      })
      .returning();
    await db.insert(executions).values({
      passId: pass!.id,
      passVersion: 1,
      takerUserId: userId,
      accountId: acct!.id,
      clientRequestId: "exec-guard-1",
      side: "buy",
      positionSize: "10",
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/me/trading-accounts/${acct!.id}`,
      headers: { cookie: await cookie(userId) },
    });
    expect(res.statusCode).toBe(403);
    const rows = await db
      .select({ n: count() })
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, acct!.id));
    expect(rows[0]!.n).toBe(1);
  });
}, 180_000);

describe("X soft disconnect keeps the identity, drops the tokens", () => {
  it("connections[x].connected false, identity row present, history intact", async () => {
    const userId = await mkUser({ identity: true, profile: true });
    const jar = await cookie(userId);
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/x/disconnect",
      headers: { cookie: jar },
    });
    expect(res.statusCode).toBe(200);

    const idRows = await db.select().from(identities).where(eq(identities.userId, userId));
    expect(idRows.length).toBe(1);
    const connRows = await db
      .select()
      .from(xConnections)
      .where(eq(xConnections.userId, userId));
    expect(connRows.length).toBe(0);

    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie: jar } });
    const body = JSON.parse(me.body) as {
      connections: Array<{ provider: string; connected: boolean; handle: string | null }>;
    };
    expect(body.connections.find((c) => c.provider === "x")).toMatchObject({
      connected: false,
      handle: "fixturehandle",
    });
  });
}, 180_000);

describe("sign-out clears the cookie only", () => {
  it("rows untouched, cookieless /me rejected", async () => {
    const userId = await mkUser({ identity: true });
    const jar = await cookie(userId);
    const out = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie: jar },
    });
    expect(out.statusCode).toBe(200);
    expect(String(out.headers["set-cookie"] ?? "")).toContain("pass_session=;");

    const idRows = await db.select().from(identities).where(eq(identities.userId, userId));
    expect(idRows.length).toBe(1);
    const naked = await app.inject({ method: "GET", url: "/api/v1/me" });
    expect(naked.statusCode).toBe(401);
  });
}, 180_000);
