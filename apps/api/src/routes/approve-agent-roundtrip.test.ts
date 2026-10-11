import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createDb,
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
 * Popup-spam session, Task 1: the agent approval must survive the round
 * trip — relay, record, and read. Approving and then reading /me must show
 * the approved agent address on that account. If /me reads null after a
 * 200 approval, the client can never skip re-approval and every Take
 * re-prompts.
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
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-agent-roundtrip";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-agent-roundtrip-test-"));
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

const AGENT = `0x${"c".repeat(40)}`;
const SIG = { r: `0x${"1".repeat(64)}`, s: `0x${"2".repeat(64)}`, v: 27 };

describe("agent approval round trip (relay → record → /me)", () => {
  it("approve-agent 200 then /me shows the agentAddress on that account", async () => {
    const [user] = await db.insert(users).values({}).returning();
    if (!user) throw new Error("fixture setup failed");
    const addr = `0x${user.id.replace(/-/g, "").padEnd(40, "0").slice(0, 40)}`;
    const [acct] = await db
      .insert(tradingAccounts)
      .values({ userId: user.id, accountAddress: addr, isPrimary: true })
      .returning();
    if (!acct) throw new Error("fixture setup failed");
    const cookie = `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`;

    const ok = await app.inject({
      method: "POST",
      url: `/api/v1/me/trading-accounts/${acct.id}/approve-agent`,
      headers: { cookie, "content-type": "application/json" },
      payload: { agentAddress: AGENT, nonce: Date.now(), signature: SIG },
    });
    expect(ok.statusCode).toBe(200);

    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    const rows = (me.json() as { tradingAccounts: Array<{ id: string; agentAddress: string | null }> })
      .tradingAccounts;
    expect(rows.find((a) => a.id === acct.id)?.agentAddress).toBe(AGENT);
  });

  it("re-approving a new agent replaces the address (no silent second row)", async () => {
    const [user] = await db.insert(users).values({}).returning();
    if (!user) throw new Error("fixture setup failed");
    const addr = `0x${user.id.replace(/-/g, "").padEnd(40, "1").slice(0, 40)}`;
    const [acct] = await db
      .insert(tradingAccounts)
      .values({ userId: user.id, accountAddress: addr, isPrimary: true })
      .returning();
    if (!acct) throw new Error("fixture setup failed");
    const cookie = `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`;
    const post = (agent: string) =>
      app.inject({
        method: "POST",
        url: `/api/v1/me/trading-accounts/${acct.id}/approve-agent`,
        headers: { cookie, "content-type": "application/json" },
        payload: { agentAddress: agent, nonce: Date.now(), signature: SIG },
      });

    expect((await post(`0x${"d".repeat(40)}`)).statusCode).toBe(200);
    expect((await post(`0x${"e".repeat(40)}`)).statusCode).toBe(200);

    const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });
    const rows = (me.json() as { tradingAccounts: Array<{ id: string; agentAddress: string | null }> })
      .tradingAccounts;
    expect(rows.filter((a) => a.id === acct.id)).toHaveLength(1);
    expect(rows.find((a) => a.id === acct.id)?.agentAddress).toBe(`0x${"e".repeat(40)}`);
  });
});
