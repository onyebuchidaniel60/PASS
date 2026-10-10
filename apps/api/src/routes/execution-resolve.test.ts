import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createDb,
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
 * D-025.4: the execution routes resolve the internal UUID first and fall
 * back to the public_id, because the Take screen only ever holds the
 * public URL. Ownership, idempotency and status checks are unchanged.
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
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-exec-resolve";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-exec-resolve-test-"));
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

async function traderWithPass(): Promise<{ cookie: string; internalId: string; publicId: string }> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: `x-resolve-${user.id}`,
    username: "resolvehandle",
    displayName: null,
    avatarUrl: null,
  });
  await db.insert(xConnections).values({
    userId: user.id,
    xUserId: `x-resolve-${user.id}`,
    xHandle: "resolvehandle",
  });
  await db.insert(profiles).values({
    userId: user.id,
    slug: `resolver_${user.id.slice(0, 8)}`,
    name: "Resolver",
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
      thesis: "Resolvable plan.",
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
  const { publicId } = published.json() as { publicId: string };
  return { cookie, internalId: id, publicId };
}

async function takerWithAccount(): Promise<{ cookie: string; accountId: string }> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  const addr = `0x${user.id.replace(/-/g, "").padEnd(40, "0").slice(0, 40)}`;
  const [acct] = await db
    .insert(tradingAccounts)
    .values({ userId: user.id, accountAddress: addr, isPrimary: true })
    .returning();
  if (!acct) throw new Error("fixture setup failed");
  return { cookie: `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`, accountId: acct.id };
}

describe("execution routes resolve public_id (D-025.4)", () => {
  it("preview accepts the public_id the Take screen holds", async () => {
    const { publicId } = await traderWithPass();
    const { cookie, accountId } = await takerWithAccount();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/execution-preview`,
      headers: { cookie, "content-type": "application/json" },
      payload: { passVersion: 1, accountId, positionSize: "250", leverage: "5" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().passVersion).toBe(1);
  });

  it("executions accepts the public_id and returns a synthetic order id in mock", async () => {
    const { publicId } = await traderWithPass();
    const { cookie, accountId } = await takerWithAccount();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie, "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountId,
        clientRequestId: `req_resolve_${Date.now()}`,
        signedPayload: { exchangeRequest: { sz: "0.01" }, signature: { mock: true } },
      },
    });
    expect(res.statusCode).toBe(201);
    expect(typeof res.json().providerOrderId).toBe("string");
  });

  it("internal UUID keeps working (D-018.4 continuity)", async () => {
    const { internalId } = await traderWithPass();
    const { cookie, accountId } = await takerWithAccount();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${internalId}/execution-preview`,
      headers: { cookie, "content-type": "application/json" },
      payload: { passVersion: 1, accountId, positionSize: "250", leverage: "5" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("unknown ids still 404 as PASS_NOT_FOUND", async () => {
    const { cookie, accountId } = await takerWithAccount();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/passes/does-not-exist/execution-preview",
      headers: { cookie, "content-type": "application/json" },
      payload: { passVersion: 1, accountId, positionSize: "250", leverage: "5" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("PASS_NOT_FOUND");
  });
});
