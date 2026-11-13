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
 * NEAR Hackathon routes:
 *  - POST /funding/intents/quote returns a deposit address and confidentiality
 *  - GET /agent/passes returns clean active Passes
 *  - POST /agent/execute relays a pre-signed order without a session
 *  - POST /trading-accounts/:address/revoke-agent clears the stored approval
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
let ctx: AppContext;

function ctxish(): AppContext {
  return { db } as unknown as AppContext;
}

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-hackathon-routes";
  resetEnv();
  const env: ApiEnv = { ...loadEnv({}), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-hackathon-routes-"));
  handle = await createDb({ pglitePath: dir });
  await runMigrations(handle);
  db = handle.db;
  ctx = {
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

async function traderWithActivePass(): Promise<{ publicId: string; cookie: string }> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: `x-hackathon-${user.id}`,
    username: "hackathonhandle",
    displayName: null,
    avatarUrl: null,
  });
  await db.insert(xConnections).values({
    userId: user.id,
    xUserId: `x-hackathon-${user.id}`,
    xHandle: "hackathonhandle",
  });
  await db.insert(profiles).values({
    userId: user.id,
    slug: `hackathon_${user.id.slice(0, 8)}`,
    name: "Hackathon",
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
      thesis: "Agent-discoverable plan.",
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
  return {
    publicId: (published.json() as { publicId: string }).publicId,
    cookie,
  };
}

describe("NEAR funding intents", () => {
  it("returns a deposit address and includes confidentiality when opted in", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/funding/intents/quote",
      headers: { "content-type": "application/json" },
      payload: {
        sourceChain: "ethereum",
        sourceToken: "USDC",
        destinationAddress: "0x1234567890abcdef1234567890abcdef12345678",
        amount: "100",
        isConfidential: true,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      depositAddress: string;
      confidentiality: string | null;
      note: string;
      poweredBy: string;
    };
    expect(body.depositAddress).toMatch(/^0x[0-9a-f]{40}$/);
    expect(body.confidentiality).toBe("basic");
    expect(body.poweredBy).toBe("NEAR Intents");
    expect(body.note).toMatch(/hide the link/);
  });
});

describe("Agent Execution API", () => {
  it("lists active Passes with clean execution fields", async () => {
    const { publicId } = await traderWithActivePass();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/agent/passes?limit=10",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      passes: Array<Record<string, unknown>>;
      count: number;
    };
    expect(body.count).toBeGreaterThan(0);
    const pass = body.passes.find((p) => p.passId === publicId);
    expect(pass).toBeDefined();
    expect(pass).toMatchObject({
      passId: publicId,
      asset: "BTC",
      direction: "long",
      entryType: "limit",
      status: "active",
      executeEndpoint: "/api/v1/agent/execute",
    });
    // No UI-only trader/reputation/market payload.
    expect(pass).not.toHaveProperty("trader");
    expect(pass).not.toHaveProperty("reputation");
    expect(pass).not.toHaveProperty("market");
  });

  it("relays a pre-signed order without a session and records it", async () => {
    const { publicId } = await traderWithActivePass();
    const agentWallet = "0x9999999999999999999999999999999999999999";
    const clientRequestId = `agent_test_${Date.now()}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agent/execute",
      headers: { "content-type": "application/json" },
      payload: {
        passId: publicId,
        agentWalletAddress: agentWallet,
        clientRequestId,
        signedPayload: {
          exchangeRequest: {
            action: {
              type: "order",
              orders: [{ a: 0, b: true, p: "113400", s: "0.02", r: false }],
              grouping: "na",
            },
            nonce: Date.now(),
          },
          signature: { mock: true },
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      executionId: string;
      providerOrderId: string;
      simulated: boolean;
      agentWalletAddress: string;
      passId: string;
    };
    expect(body.passId).toBe(publicId);
    expect(body.agentWalletAddress).toBe(agentWallet);
    expect(body.simulated).toBe(true);
    expect(body.providerOrderId.startsWith("mock_")).toBe(true);

    const rows = await db
      .select()
      .from(executions)
      .where(eq(executions.clientRequestId, clientRequestId))
      .limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.positionSize).toBe("0.02");
  });
});

describe("Agent key revocation", () => {
  it("clears the stored agent approval after Hyperliquid accepts the replacement", async () => {
    const [user] = await db.insert(users).values({}).returning();
    if (!user) throw new Error("fixture setup failed");
    const address = "0x7777777777777777777777777777777777777777";
    await db.insert(tradingAccounts).values({
      userId: user.id,
      accountAddress: address,
      agentAddress: "0x8888888888888888888888888888888888888888",
      agentApprovedAt: new Date(),
      venue: "mock",
      isPrimary: true,
    });
    const cookie = `${SESSION_COOKIE}=${await createSession(ctxish(), user.id)}`;

    const before = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie },
    });
    const beforeAccount = (
      before.json() as {
        tradingAccounts: Array<{ agentApproved: boolean; agentAddress: string | null }>;
      }
    ).tradingAccounts[0];
    expect(beforeAccount?.agentApproved).toBe(true);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/trading-accounts/${address}/revoke-agent`,
      headers: { "content-type": "application/json" },
      payload: {
        agentAddress: "0x6666666666666666666666666666666666666666",
        nonce: Date.now(),
        signature: { r: `0x${"11".repeat(32)}`, s: `0x${"22".repeat(32)}`, v: 27 },
        revokedAgentAddress: "0x8888888888888888888888888888888888888888",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const after = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie },
    });
    const afterAccount = (
      after.json() as {
        tradingAccounts: Array<{ agentApproved: boolean; agentAddress: string | null }>;
      }
    ).tradingAccounts[0];
    expect(afterAccount?.agentApproved).toBe(false);
    expect(afterAccount?.agentAddress).toBeNull();
  });
});
