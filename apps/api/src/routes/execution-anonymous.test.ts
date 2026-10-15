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
 * D-026: taking a Pass requires a wallet signature, not a PASS session.
 * Preview, agent approval (on user-less rows), and execution submission
 * all work with no session cookie when the request resolves by wallet
 * address. Owned rows keep session + ownership enforcement.
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
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-anon-take";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-anon-take-test-"));
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
    demoMode: true,
    close: handle.close,
  };
  app = await buildApp(ctx);
}, 300_000);

afterAll(async () => {
  await app.close();
  await handle.close();
});

const RUN = Date.now().toString(16).padStart(12, "0").slice(-12);
const anonAddr = (s: string) =>
  `0x${s}${RUN}`.slice(0, 42).padEnd(42, "0").toLowerCase();

async function traderWithPass(): Promise<{ publicId: string }> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: `x-anon-${user.id}`,
    username: "anonhandle",
    displayName: null,
    avatarUrl: null,
  });
  await db.insert(xConnections).values({
    userId: user.id,
    xUserId: `x-anon-${user.id}`,
    xHandle: "anonhandle",
  });
  await db.insert(profiles).values({
    userId: user.id,
    slug: `anontaker_${user.id.slice(0, 8)}`,
    name: "AnonTaker",
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
      thesis: "Anon fixture plan.",
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

const SIGNED = {
  exchangeRequest: { action: { type: "order" }, nonce: 1 },
  signature: { mock: true },
};

describe("anonymous Take (D-026)", () => {
  it("previews by wallet address with no session", async () => {
    const { publicId } = await traderWithPass();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/execution-preview`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: anonAddr("a1"),
        positionSize: "100",
        leverage: "2",
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { accountId: string; passVersion: number };
    expect(body.passVersion).toBe(1);
    expect(typeof body.accountId).toBe("string");
  });

  it("refuses a sub-$10 preview with BELOW_MIN_ORDER_VALUE before signing", async () => {
    const { publicId } = await traderWithPass();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/execution-preview`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: anonAddr("c3"),
        positionSize: "5",
        leverage: "2",
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe("BELOW_MIN_ORDER_VALUE");
    expect(body.error.message).toMatch(/\$10/);
  });

  it("executes with no session: 201, mock id, simulated, taker null, user-less row", async () => {
    const { publicId } = await traderWithPass();
    const address = anonAddr("b2");
    const clientRequestId = `req_anon_${RUN}_b2`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: address,
        clientRequestId,
        signedPayload: SIGNED,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      providerOrderId: string;
      simulated: boolean;
      status: string;
    };
    expect(body.providerOrderId.startsWith("mock_")).toBe(true);
    expect(body.simulated).toBe(true);

    const rows = await db
      .select()
      .from(executions)
      .where(eq(executions.clientRequestId, clientRequestId))
      .limit(1);
    expect(rows.length).toBe(1);
    expect(rows[0]!.takerUserId).toBeNull();

    const accts = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.accountAddress, address))
      .limit(1);
    expect(accts.length).toBe(1);
    expect(accts[0]!.userId).toBeNull();
  });

  it("reuses the same user-less row on a second anonymous take", async () => {
    const { publicId } = await traderWithPass();
    const address = anonAddr("c3");
    const first = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: address,
        clientRequestId: `req_anon_${RUN}_c3a`,
        signedPayload: SIGNED,
      },
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: address,
        clientRequestId: `req_anon_${RUN}_c3b`,
        signedPayload: SIGNED,
      },
    });
    expect(second.statusCode).toBe(201);
    const rows = await db
      .select({ accountId: executions.accountId })
      .from(executions)
      .where(eq(executions.accountId, (await accountIdFor(address)) as string));
    expect(rows.length).toBe(2);
    const acctCount = await db
      .select({ n: count() })
      .from(tradingAccounts)
      .where(eq(tradingAccounts.accountAddress, address));
    expect(acctCount[0]!.n).toBe(1);
  });

  it("dedups a repeated anonymous clientRequestId", async () => {
    const { publicId } = await traderWithPass();
    const address = anonAddr("d4");
    const payload = {
      passVersion: 1,
      accountAddress: address,
      clientRequestId: `req_anon_${RUN}_d4`,
      signedPayload: SIGNED,
    };
    const first = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload,
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().providerOrderId).toBe(first.json().providerOrderId);
    const n = await db
      .select({ n: count() })
      .from(executions)
      .where(eq(executions.clientRequestId, payload.clientRequestId));
    expect(n[0]!.n).toBe(1);
  });

  it("approves an agent on a user-less row with no session and never assigns it", async () => {
    const { publicId } = await traderWithPass();
    const address = anonAddr("e5");
    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/execution-preview`,
      headers: { "content-type": "application/json" },
      payload: { passVersion: 1, accountAddress: address, positionSize: "100" },
    });
    expect(preview.statusCode).toBe(200);
    const { accountId } = preview.json() as { accountId: string };
    const agent = `0x${"e".repeat(40)}`;
    const ok = await app.inject({
      method: "POST",
      url: `/api/v1/me/trading-accounts/${accountId}/approve-agent`,
      headers: { "content-type": "application/json" },
      payload: {
        agentAddress: agent,
        nonce: Date.now(),
        signature: { r: `0x${"1".repeat(64)}`, s: `0x${"2".repeat(64)}`, v: 27 },
      },
    });
    expect(ok.statusCode).toBe(200);
    const rows = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, accountId))
      .limit(1);
    expect(rows[0]!.agentAddress).toBe(agent);
    expect(rows[0]!.userId).toBeNull();
  });

  it("keeps /me/executions free of anonymous executions", async () => {
    const { publicId } = await traderWithPass();
    const anon = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountAddress: anonAddr("f6"),
        clientRequestId: `req_anon_${RUN}_f6`,
        signedPayload: SIGNED,
      },
    });
    expect(anon.statusCode).toBe(201);
    const anonOrderId = (anon.json() as { providerOrderId: string }).providerOrderId;

    const [user] = await db.insert(users).values({}).returning();
    if (!user) throw new Error("fixture setup failed");
    const cookie = `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`;
    const mine = await app.inject({
      method: "GET",
      url: "/api/v1/me/executions?limit=100",
      headers: { cookie },
    });
    expect(mine.statusCode).toBe(200);
    const listed = (mine.json() as { executions: Array<{ providerOrderId: string }> })
      .executions;
    expect(listed.find((e) => e.providerOrderId === anonOrderId)).toBeUndefined();
  });

  it("D-027: accountId needs no session and no ownership — wallets are execution devices", async () => {
    const { publicId } = await traderWithPass();
    const [owner] = await db.insert(users).values({}).returning();
    if (!owner) throw new Error("fixture setup failed");
    const [acct] = await db
      .insert(tradingAccounts)
      .values({
        userId: owner.id,
        provider: "hyperliquid",
        accountAddress: anonAddr("77"),
        isPrimary: true,
      })
      .returning();
    if (!acct) throw new Error("fixture setup failed");

    // accountId with no session → completes (was 401 before D-027).
    const nosess = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountId: acct.id,
        clientRequestId: `req_anon_${RUN}_g1`,
        signedPayload: SIGNED,
      },
    });
    expect(nosess.statusCode).toBe(201);

    // accountId recorded by someone else, caller's own session → completes
    // (was 403 "never borrowed" before D-027). The row keeps its recorded
    // user_id: use is not ownership.
    const [other] = await db.insert(users).values({}).returning();
    if (!other) throw new Error("fixture setup failed");
    const borrowed = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: {
        cookie: `${SESSION_COOKIE}=${await createSession(ctxish(), other.id)}`,
        "content-type": "application/json",
      },
      payload: {
        passVersion: 1,
        accountId: acct.id,
        clientRequestId: `req_anon_${RUN}_g2`,
        signedPayload: SIGNED,
      },
    });
    expect(borrowed.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, acct.id))
      .limit(1);
    expect(rows[0]!.userId).toBe(owner.id);
  });
});

async function accountIdFor(address: string): Promise<string | null> {
  const rows = await db
    .select({ id: tradingAccounts.id })
    .from(tradingAccounts)
    .where(eq(tradingAccounts.accountAddress, address))
    .limit(1);
  return rows[0]?.id ?? null;
}
