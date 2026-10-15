import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  createDb,
  executions,
  passes,
  runMigrations,
  tradingAccounts,
  users,
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
 * One wallet per user: POST /me/trading-accounts replaces the caller's
 * existing rows, stays idempotent for the same address, and refuses a
 * replace over rows with executions on record (D-008 auditability — the
 * same guard as the DELETE route).
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

async function mkUser(): Promise<string> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  return user.id;
}

async function cookie(userId: string): Promise<string> {
  return `${SESSION_COOKIE}=${await createSession(ctxish(), userId)}`;
}

const addr = (ch: string, n: number) => `0x${ch.repeat(39)}${n}`;
// Each test gets its own addresses: (provider, account_address) is globally
// unique, so reusing one address across tests would trip the clash guard.
const T1 = { A: addr("a", 1), B: addr("b", 1) };
const T2 = { A: addr("a", 2), B: addr("b", 2) };
const T3 = { A: addr("a", 3), B: addr("b", 3) };
const T4 = { A: addr("a", 4), B: addr("b", 4) };
const T5 = { A: addr("a", 5), B: addr("b", 5) };
const T6 = { A: addr("a", 6), B: addr("b", 6) };

async function rowsFor(userId: string) {
  return db.select().from(tradingAccounts).where(eq(tradingAccounts.userId, userId));
}

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-wallet-replace";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-wallet-replace-test-"));
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

describe("POST /me/trading-accounts replace semantics", () => {
  it("links the first wallet", async () => {
    const userId = await mkUser();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T1.A },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { id: string; accountAddress: string };
    expect(body.accountAddress).toBe(T1.A);
    expect(await rowsFor(userId)).toHaveLength(1);
  });

  it("accepts the optional provider field", async () => {
    const userId = await mkUser();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T2.A, provider: "hyperliquid" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("re-linking the same address is idempotent, not a second row", async () => {
    const userId = await mkUser();
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T3.A },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T3.A },
    });
    expect(second.statusCode).toBe(200);
    expect((JSON.parse(second.body) as { id: string }).id).toBe(
      (JSON.parse(first.body) as { id: string }).id,
    );
    expect(await rowsFor(userId)).toHaveLength(1);
  });

  it("linking a different address retires the old row, one active", async () => {
    const userId = await mkUser();
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T4.A },
    });
    const oldId = (JSON.parse(first.body) as { id: string }).id;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T4.B },
    });
    expect(res.statusCode).toBe(200);
    // History survives: two rows, exactly one active — the new one.
    const rows = await rowsFor(userId);
    expect(rows).toHaveLength(2);
    const active = rows.filter((r) => r.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]!.accountAddress).toBe(T4.B);
    expect(active[0]!.id).not.toBe(oldId);
    expect(rows.find((r) => r.id === oldId)!.isActive).toBe(false);
  });

  it("replace succeeds even when the old row has executions on record", async () => {
    const userId = await mkUser();
    await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T5.A },
    });
    const [acct] = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.userId, userId));
    const [pass] = await db
      .insert(passes)
      .values({
        publicId: `walletguard${Date.now() % 100000}`,
        traderId: userId,
        slug: "guard-hl-long",
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
      clientRequestId: `wallet-guard-${acct!.id.slice(0, 8)}`,
      side: "buy",
      positionSize: "10",
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(userId) },
      payload: { accountAddress: T5.B },
    });
    expect(res.statusCode).toBe(200);
    // Old row retired in place with the execution FK intact.
    const rows = await rowsFor(userId);
    expect(rows).toHaveLength(2);
    const active = rows.filter((r) => r.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]!.accountAddress).toBe(T5.B);
    const old = rows.find((r) => r.accountAddress === T5.A)!;
    expect(old.isActive).toBe(false);
    const execRows = await db
      .select()
      .from(executions)
      .where(eq(executions.accountId, old.id));
    expect(execRows).toHaveLength(1);
  });

  it("D-027: linking an already-linked wallet adopts it without reassigning user_id", async () => {
    const owner = await mkUser();
    const other = await mkUser();
    await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(owner) },
      payload: { accountAddress: T6.A },
    });
    // Wallets are execution devices, not owned: connecting an address
    // another user linked is allowed (was 403 before D-027). The recorded
    // first-linker is never reassigned by someone else's use.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: await cookie(other) },
      payload: { accountAddress: T6.A },
    });
    expect(res.statusCode).toBe(200);
    const adopted = res.json() as { id: string };
    const [row] = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.accountAddress, T6.A));
    expect(adopted.id).toBe(row!.id);
    expect(row!.userId).toBe(owner);
    expect(await rowsFor(other)).toHaveLength(0);
  });

  it("/me returns only the active row after a swap", async () => {
    const userId = await mkUser();
    const jar = await cookie(userId);
    await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: jar },
      payload: { accountAddress: T6.B },
    });
    // T6.A belongs to another user from the previous test, so link two
    // fresh addresses instead: link, then swap.
    const fresh1 = addr("c", 6);
    const fresh2 = addr("d", 6);
    await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: jar },
      payload: { accountAddress: fresh1 },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: jar },
      payload: { accountAddress: fresh2 },
    });
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: jar },
    });
    const accounts = (me.json() as { tradingAccounts: Array<{ accountAddress: string }> })
      .tradingAccounts;
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.accountAddress).toBe(fresh2);
  });

  it("historical executions still render after the wallet is swapped", async () => {
    const userId = await mkUser();
    const jar = await cookie(userId);
    const linked = await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: jar },
      payload: { accountAddress: addr("e", 6) },
    });
    const accountId = (JSON.parse(linked.body) as { id: string }).id;
    const [pass] = await db
      .insert(passes)
      .values({
        publicId: `wallethist${Date.now() % 100000}`,
        traderId: userId,
        slug: "hist-hl-long",
        version: 1,
        asset: "ETH",
        direction: "long",
        entryType: "market",
        thesis: "History fixture.",
        status: "active",
      })
      .returning();
    await db.insert(executions).values({
      passId: pass!.id,
      passVersion: 1,
      takerUserId: userId,
      accountId,
      clientRequestId: `wallet-hist-${accountId.slice(0, 8)}`,
      side: "buy",
      positionSize: "10",
    });
    // Swap wallets, then unlink entirely: the execution must still list.
    await app.inject({
      method: "POST",
      url: "/api/v1/me/trading-accounts",
      headers: { cookie: jar },
      payload: { accountAddress: addr("f", 6) },
    });
    const mine = await app.inject({
      method: "GET",
      url: "/api/v1/me/executions",
      headers: { cookie: jar },
    });
    expect(mine.statusCode).toBe(200);
    const list = (mine.json() as { executions: Array<{ passId: string }> }).executions;
    expect(list.some((e) => e.passId === pass!.id)).toBe(true);
  });
}, 180_000);
