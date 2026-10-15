import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  createDb,
  executions,
  identities,
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
 * D-027: wallets are execution-only, not owned.
 *
 * - POST /api/v1/trading-accounts/:address/approve-agent needs no session
 *   and never checks user_id; the master wallet signature is the authority.
 * - A session whose user_id does not match the wallet's recorded
 *   first-linker still succeeds, and the recorded user_id is untouched.
 * - Executions resolve by row id or wallet address with no ownership gate.
 * - GET /api/v1/executions?accountAddress= lists a wallet's executions
 *   with no session.
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

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-d027";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-d027-test-"));
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

const RUN = Date.now().toString(16).padStart(12, "0").slice(-12);
const waddr = (s: string) =>
  `0x${s}${RUN}`.slice(0, 42).padEnd(42, "0").toLowerCase();
const AGENT = (s: string) => `0x${s}`.slice(0, 42).padEnd(42, "a").toLowerCase();
const SIG = { r: `0x${"22".repeat(32)}`, s: `0x${"33".repeat(32)}`, v: 27 };

function approvePayload(agent: string) {
  return {
    agentAddress: agent,
    nonce: Date.now(),
    signature: SIG,
  };
}

async function rowByAddress(address: string) {
  const rows = await db
    .select()
    .from(tradingAccounts)
    .where(eq(tradingAccounts.accountAddress, address.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

describe("approve-agent address route (D-027)", () => {
  it("succeeds with NO session on a wallet that was never seen before", async () => {
    const address = waddr("aa");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/trading-accounts/${address}/approve-agent`,
      headers: { "content-type": "application/json" },
      payload: approvePayload(AGENT("b")),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accountAddress).toBe(address);
    const row = await rowByAddress(address);
    expect(row).not.toBeNull();
    expect(row!.userId).toBeNull();
    expect(row!.agentAddress).toBe(AGENT("b"));
  });

  it("succeeds with a session whose user does NOT match the recorded linker", async () => {
    // User A linked the wallet long ago (the live 403 repro: a signed-in
    // user whose session no longer matches, or another user entirely).
    const [userA] = await db.insert(users).values({}).returning();
    const [userB] = await db.insert(users).values({}).returning();
    if (!userA || !userB) throw new Error("fixture setup failed");
    const address = waddr("bb");
    await db.insert(tradingAccounts).values({
      userId: userA.id,
      provider: "hyperliquid",
      accountAddress: address,
      isPrimary: true,
    });
    const cookieB = `${SESSION_COOKIE}=${await createSession(ctxish(), userB.id)}`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/trading-accounts/${address}/approve-agent`,
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: approvePayload(AGENT("c")),
    });
    expect(res.statusCode).toBe(200);
    const row = await rowByAddress(address);
    // Approval recorded, first-linker attribution untouched (D-027: user_id
    // is informational and never reassigned by use).
    expect(row!.agentAddress).toBe(AGENT("c"));
    expect(row!.userId).toBe(userA.id);
  });

  it("rejects a malformed wallet address with 400, never 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trading-accounts/not-an-address/approve-agent",
      headers: { "content-type": "application/json" },
      payload: approvePayload(AGENT("d")),
    });
    expect(res.statusCode).toBe(400);
  });

  it("the deprecated /me alias still approves for a matching session", async () => {
    const [user] = await db.insert(users).values({}).returning();
    if (!user) throw new Error("fixture setup failed");
    const address = waddr("cc");
    const [acct] = await db
      .insert(tradingAccounts)
      .values({ userId: user.id, accountAddress: address, isPrimary: true })
      .returning();
    if (!acct) throw new Error("fixture setup failed");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/me/trading-accounts/${acct.id}/approve-agent`,
      headers: {
        cookie: `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`,
        "content-type": "application/json",
      },
      payload: approvePayload(AGENT("e")),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accountAddress).toBe(address);
  });
});

const SIGNED = {
  exchangeRequest: { action: { type: "order" }, nonce: 1 },
  signature: { mock: true },
};

async function traderWithPass(): Promise<{ publicId: string }> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: `x-d027-${user.id}`,
    username: "d027handle",
    displayName: null,
    avatarUrl: null,
  });
  await db.insert(xConnections).values({
    userId: user.id,
    xUserId: `x-d027-${user.id}`,
    xHandle: "d027handle",
  });
  await db.insert(profiles).values({
    userId: user.id,
    slug: `d027taker_${user.id.slice(0, 8)}`,
    name: "D027Taker",
    bio: null,
  });
  const cookie = `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`;
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/passes",
    headers: { cookie, "content-type": "application/json" },
    payload: {
      asset: "BTC",
      direction: "long",
      entryType: "limit",
      entryPrice: "113400",
      stopLoss: "111900",
      takeProfit: "116000",
      leverage: "5",
      thesis: "D-027 fixture plan.",
    },
  });
  expect(created.statusCode).toBe(200);
  const { id } = created.json() as { id: string };
  const published = await app.inject({
    method: "POST",
    url: `/api/v1/passes/${id}/publish`,
    headers: { cookie },
  });
  expect(published.statusCode).toBe(200);
  return published.json() as { publicId: string };
}

describe("executions under D-027", () => {
  it("signed-in user B executes with a wallet recorded by user A (address form)", async () => {
    const { publicId } = await traderWithPass();
    const [userA] = await db.insert(users).values({}).returning();
    const [userB] = await db.insert(users).values({}).returning();
    if (!userA || !userB) throw new Error("fixture setup failed");
    const address = waddr("dd");
    await db.insert(tradingAccounts).values({
      userId: userA.id,
      provider: "hyperliquid",
      accountAddress: address,
      isPrimary: true,
    });
    const cookieB = `${SESSION_COOKIE}=${await createSession(ctxish(), userB.id)}`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: address,
        clientRequestId: `req_d027_${RUN}_dd`,
        signedPayload: SIGNED,
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("signed-in user B executes with a wallet recorded by user A (id form)", async () => {
    const { publicId } = await traderWithPass();
    const [userA] = await db.insert(users).values({}).returning();
    const [userB] = await db.insert(users).values({}).returning();
    if (!userA || !userB) throw new Error("fixture setup failed");
    const address = waddr("de");
    const [acct] = await db
      .insert(tradingAccounts)
      .values({
        userId: userA.id,
        provider: "hyperliquid",
        accountAddress: address,
        isPrimary: true,
      })
      .returning();
    if (!acct) throw new Error("fixture setup failed");
    const cookieB = `${SESSION_COOKIE}=${await createSession(ctxish(), userB.id)}`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountId: acct.id,
        clientRequestId: `req_d027_${RUN}_de`,
        signedPayload: SIGNED,
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it("anonymous Take with a fresh wallet creates a NULL-user row and completes", async () => {
    const { publicId } = await traderWithPass();
    const address = waddr("df");
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: address,
        clientRequestId: `req_d027_${RUN}_df`,
        signedPayload: SIGNED,
      },
    });
    expect(res.statusCode).toBe(201);
    const row = await rowByAddress(address);
    expect(row).not.toBeNull();
    expect(row!.userId).toBeNull();
  });

  it("GET /api/v1/executions lists a wallet's executions with no session", async () => {
    const { publicId } = await traderWithPass();
    const address = waddr("e0");
    const took = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: address,
        clientRequestId: `req_d027_${RUN}_e0`,
        signedPayload: SIGNED,
      },
    });
    expect(took.statusCode).toBe(201);
    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/executions?accountAddress=${address}&limit=10`,
    });
    expect(listed.statusCode).toBe(200);
    const body = listed.json() as { executions: Array<{ providerOrderId: string }> };
    expect(
      body.executions.find(
        (e) => e.providerOrderId === (took.json() as { providerOrderId: string }).providerOrderId,
      ),
    ).toBeDefined();
  });

  it("GET /api/v1/executions lists empty (200, not 404) for an unknown wallet", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/executions?accountAddress=${waddr("e9")}&limit=10`,
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { executions: unknown[] }).executions).toEqual([]);
  });
});
