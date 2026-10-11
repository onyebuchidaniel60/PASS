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
 * approve-agent signature shape (API_CONTRACTS.md §8) and the validation
 * error code (§14).
 *
 * The client posts the wallet's flat 0x signature split into { r, s, v }.
 * A flat string fails the record schema: that must be a 400 with the
 * generic INVALID_REQUEST code (a previous revision mislabelled every
 * schema failure INVALID_PRICE), and the split shape must reach 200 in
 * mock mode.
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
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-approve-shape";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-approve-shape-test-"));
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

const AGENT = "0xd351CeD8e0c55EE939bB7C4C78897127fdf8c6d2";
const R = `0x${"22".repeat(32)}`;
const S = `0x${"33".repeat(32)}`;

async function userWithAccount(): Promise<{ cookie: string; accountId: string }> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  const addr = `0x${user.id.replace(/-/g, "").padEnd(40, "0").slice(0, 40)}`;
  const [acct] = await db
    .insert(tradingAccounts)
    .values({ userId: user.id, accountAddress: addr, isPrimary: true })
    .returning();
  if (!acct) throw new Error("fixture setup failed");
  return {
    cookie: `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`,
    accountId: acct.id,
  };
}

describe("approve-agent signature shape (§8)", () => {
  it("rejects a flat-string signature with 400 INVALID_REQUEST", async () => {
    const { cookie, accountId } = await userWithAccount();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/me/trading-accounts/${accountId}/approve-agent`,
      headers: { cookie, "content-type": "application/json" },
      payload: {
        agentAddress: AGENT,
        nonce: Date.now(),
        signature: `0x${"22".repeat(64)}1b`,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json() as {
      error: { code: string; issues?: unknown };
    };
    // Not INVALID_PRICE (a price was never involved) and not
    // SIGNATURE_REJECTED (the provider never saw it — the shape was bad).
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("accepts the { r, s, v } shape the client posts and approves in mock", async () => {
    const { cookie, accountId } = await userWithAccount();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/me/trading-accounts/${accountId}/approve-agent`,
      headers: { cookie, "content-type": "application/json" },
      payload: {
        agentAddress: AGENT,
        nonce: Date.now(),
        signature: { r: R, s: S, v: 27 },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().agentAddress).toBe(AGENT.toLowerCase());
  });
});
