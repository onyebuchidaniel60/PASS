import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  createDb,
  executions,
  feeLedger,
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
 * Stage F closure Task 1 — mock mode simulates a successful order relay.
 *
 * - Mock + valid signed order → 201 with a `mock_<uuid>` provider id,
 *   execution row written with `simulated: true`.
 * - Mock + signed order → zero outbound HTTP calls to Hyperliquid.
 * - Live mode unchanged is covered at the adapter level in
 *   `packages/integrations/src/hyperliquid/live.test.ts`.
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
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-exec-mock-sim";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-exec-mock-sim-test-"));
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

async function traderWithPass(): Promise<{ publicId: string; cookie: string }> {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: `x-mocksim-${user.id}`,
    username: "mocksimhandle",
    displayName: null,
    avatarUrl: null,
  });
  await db.insert(xConnections).values({
    userId: user.id,
    xUserId: `x-mocksim-${user.id}`,
    xHandle: "mocksimhandle",
  });
  await db.insert(profiles).values({
    userId: user.id,
    slug: `mocksim_${user.id.slice(0, 8)}`,
    name: "MockSim",
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
      thesis: "MockSim plan.",
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
  return { publicId, cookie };
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

describe("mock execution relay simulates success", () => {
  it("201 with mock_<uuid> id, simulated:true, row marked simulated, no fetch", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("must not call fetch in mock"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { publicId } = await traderWithPass();
      const { cookie, accountId } = await takerWithAccount();
      const clientRequestId = `req_mocksim_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/passes/${publicId}/executions`,
        headers: { cookie, "content-type": "application/json" },
        payload: {
          passVersion: 1,
          accountId,
          clientRequestId,
          signedPayload: { exchangeRequest: { sz: "0.01" }, signature: { mock: true } },
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as { providerOrderId: string; simulated: boolean; status: string };
      expect(body.providerOrderId.startsWith("mock_")).toBe(true);
      expect(body.simulated).toBe(true);
      expect(body.status).toBe("pending");

      const rows = await db
        .select()
        .from(executions)
        .where(eq(executions.clientRequestId, clientRequestId))
        .limit(1);
      expect(rows.length).toBe(1);
      expect(rows[0]!.providerOrderId).toBe(body.providerOrderId);
      expect((rows[0] as { simulated?: boolean }).simulated).toBe(true);

      const mine = await app.inject({
        method: "GET",
        url: "/api/v1/me/executions?limit=10",
        headers: { cookie },
      });
      expect(mine.statusCode).toBe(200);
      const listed = (mine.json() as { executions: Array<{ providerOrderId: string; simulated: boolean }> })
        .executions;
      const found = listed.find((e) => e.providerOrderId === body.providerOrderId);
      expect(found?.simulated).toBe(true);

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("duplicate clientRequestId returns the original simulated record", async () => {
    const { publicId } = await traderWithPass();
    const { cookie, accountId } = await takerWithAccount();
    const clientRequestId = `req_mockdup_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const payload = {
      passVersion: 1,
      accountId,
      clientRequestId,
      signedPayload: { exchangeRequest: { sz: "0.01" }, signature: { mock: true } },
    };
    const first = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie, "content-type": "application/json" },
      payload,
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie, "content-type": "application/json" },
      payload,
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().providerOrderId).toBe(first.json().providerOrderId);
    expect(second.json().simulated).toBe(true);
  });

  it("records the signed entry-leg base size, not zero (Stage G PnL input)", async () => {
    // The real client sends exchangeRequest { action, nonce } with no
    // top-level sz; the row must carry action.orders[0].s or every
    // realized-PnL computation multiplies by zero.
    const { publicId } = await traderWithPass();
    const { cookie, accountId } = await takerWithAccount();
    const clientRequestId = `req_mocksz_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie, "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountId,
        clientRequestId,
        signedPayload: {
          exchangeRequest: {
            action: { type: "order", orders: [{ a: 0, b: true, p: "113400", s: "0.01102", r: false }], grouping: "na" },
            nonce: Date.now(),
          },
          signature: { mock: true },
        },
      },
    });
    expect(res.statusCode).toBe(201);
    const rows = await db
      .select()
      .from(executions)
      .where(eq(executions.clientRequestId, clientRequestId))
      .limit(1);
    expect(rows[0]!.positionSize).toBe("0.01102");
  });

  it("one mock execution writes one simulated fee_ledger row with correct math", async () => {
    // sizeUsd 100 x leverage 2 = 200 notional -> 0.10 fee at 5 bps,
    // split 0.05 creator / 0.05 protocol. The flat response fields carry
    // the same values the Take receipt renders.
    const { publicId } = await traderWithPass();
    const { cookie, accountId } = await takerWithAccount();
    const clientRequestId = `req_mockfee_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie, "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountId,
        clientRequestId,
        positionSize: "100",
        leverage: "2",
        signedPayload: { exchangeRequest: { sz: "0.01" }, signature: { mock: true } },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as {
      executionId: string;
      simulated: boolean;
      notionalUsd: string | null;
      feeUsd: string | null;
      creatorShareUsd: string | null;
      protocolShareUsd: string | null;
      builderFeeBps: number | null;
    };
    expect(body.simulated).toBe(true);
    expect(Number(body.notionalUsd)).toBeCloseTo(200, 8);
    expect(Number(body.feeUsd)).toBeCloseTo(0.1, 8);
    expect(Number(body.creatorShareUsd)).toBeCloseTo(0.05, 8);
    expect(Number(body.protocolShareUsd)).toBeCloseTo(0.05, 8);
    expect(body.builderFeeBps).toBe(5);

    const feeRows = await db
      .select()
      .from(feeLedger)
      .where(eq(feeLedger.executionId, body.executionId));
    expect(feeRows).toHaveLength(1);
    expect(Number(feeRows[0]!.notionalUsd)).toBeCloseTo(200, 8);
    expect(Number(feeRows[0]!.feeUsd)).toBeCloseTo(0.1, 8);
    expect(Number(feeRows[0]!.creatorShareUsd)).toBeCloseTo(0.05, 8);
    expect(Number(feeRows[0]!.protocolShareUsd)).toBeCloseTo(0.05, 8);
    expect(feeRows[0]!.builderFeeBps).toBe(5);
    expect(feeRows[0]!.simulated).toBe(true);
  });

  it("sums the creator share into GET /api/v1/me/passes feesEarnedUsd", async () => {
    const { publicId, cookie: traderCookie } = await traderWithPass();
    const { cookie: takerCookie, accountId } = await takerWithAccount();
    const exec = await app.inject({
      method: "POST",
      url: `/api/v1/passes/${publicId}/executions`,
      headers: { cookie: takerCookie, "content-type": "application/json" },
      payload: {
        passVersion: 1,
        accountId,
        clientRequestId: `req_mockme_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
        positionSize: "100",
        leverage: "2",
        signedPayload: { exchangeRequest: { sz: "0.01" }, signature: { mock: true } },
      },
    });
    expect(exec.statusCode).toBe(201);

    const mine = await app.inject({
      method: "GET",
      url: "/api/v1/me/passes?limit=10",
      headers: { cookie: traderCookie },
    });
    expect(mine.statusCode).toBe(200);
    const listed = (
      mine.json() as { passes: Array<{ publicId: string; feesEarnedUsd: string | null }> }
    ).passes;
    const found = listed.find((p) => p.publicId === publicId);
    expect(found).toBeDefined();
    expect(Number(found!.feesEarnedUsd)).toBeCloseTo(0.05, 8);
  });
});
