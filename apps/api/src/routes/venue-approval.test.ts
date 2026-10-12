import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  createDb,
  tradingAccounts,
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
import { SESSION_COOKIE, createSession } from "../plugins/session.js";

/**
 * Agent approvals are venue-scoped. A stored agentAddress presents through
 * /me only when its venue matches the current one; otherwise it reads as
 * not-approved and the client re-prompts approveAgent instead of signing
 * against a void approval ("User or API Wallet … does not exist").
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

const AGENT = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ACCT_HIDE = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ACCT_RECORD = "0xcccccccccccccccccccccccccccccccccccccccc";

async function boot(env: ApiEnv): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "pass-venue-test-"));
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
}

type MeAccount = { id: string; accountAddress: string; agentAddress: string | null };

async function meAccounts(jar: string): Promise<MeAccount[]> {
  const res = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie: jar } });
  return (res.json() as { tradingAccounts: MeAccount[] }).tradingAccounts;
}

describe("venue-scoped agent approval (mock venue)", () => {
  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-for-venue";
    resetEnv();
    await boot({ ...loadEnv(), APP_URL: "http://test.local" });
  }, 300_000);

  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it("presents the approval only when the stored venue matches", async () => {
    const userId = await mkUser();
    const jar = await cookie(userId);
    await db.insert(tradingAccounts).values({
      userId,
      provider: "hyperliquid",
      accountAddress: ACCT_HIDE,
      agentAddress: AGENT,
      venue: "mainnet",
    });
    // Current venue here is mock: the mainnet approval must hide.
    expect((await meAccounts(jar))[0]!.agentAddress).toBeNull();
  });

  it("records the current venue on approval, then presents it", async () => {
    const userId = await mkUser();
    const jar = await cookie(userId);
    const [acct] = await db
      .insert(tradingAccounts)
      .values({ userId, provider: "hyperliquid", accountAddress: ACCT_RECORD })
      .returning();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/me/trading-accounts/${acct!.id}/approve-agent`,
      headers: { cookie: jar },
      payload: { agentAddress: AGENT, nonce: Date.now(), signature: { r: "0x1", s: "0x2", v: 27 } },
    });
    expect(res.statusCode).toBe(200);
    const rows = await db
      .select()
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, acct!.id));
    expect(rows[0]!.venue).toBe("mock");
    expect((await meAccounts(jar))[0]!.agentAddress).toBe(AGENT.toLowerCase());
  });
});

describe("venue-scoped agent approval (testnet mirror)", () => {
  const saved = { ...process.env };

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-for-venue-live";
    process.env.HYPERLIQUID_INFO_URL = "https://api.hyperliquid-testnet.xyz/info";
    process.env.HYPERLIQUID_EXCHANGE_URL = "https://api.hyperliquid-testnet.xyz/exchange";
    process.env.HYPERLIQUID_READS_MODE = "live";
    process.env.HYPERLIQUID_MODE = "live";
    resetEnv();
    const { createAdapters } = await import("@pass/integrations");
    const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
    const dir = mkdtempSync(join(tmpdir(), "pass-venue-live-test-"));
    handle = await createDb({ pglitePath: dir });
    await runMigrations(handle);
    db = handle.db;
    const ctx: AppContext = {
      env,
      db,
      handle,
      adapters: {
        ...createAdapters(env),
        ethos: new MockEthos(),
        x: stubX(),
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
    process.env = saved;
  });

  it("on testnet, only a testnet approval presents; mainnet/mock hide", async () => {
    const userId = await mkUser();
    const jar = await cookie(userId);
    for (const [i, venue] of ["mainnet", "mock", "testnet"].entries()) {
      await db.insert(tradingAccounts).values({
        userId,
        provider: "hyperliquid",
        accountAddress: `0x${String(i + 1).repeat(40)}`,
        agentAddress: AGENT,
        venue,
      });
    }
    const shown = (await meAccounts(jar)).filter((a) => a.agentAddress !== null);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.agentAddress).toBe(AGENT.toLowerCase());
  });

  it("/health reports the current venue for signing clients", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { hyperliquidVenue: string }).hyperliquidVenue).toBe(
      "testnet",
    );
  });
});
