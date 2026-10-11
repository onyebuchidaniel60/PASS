import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  createDb,
  executions,
  passes,
  passEvents,
  passVersions,
  tradingAccounts,
  users,
  type DbHandle,
} from "@pass/db";
import type { Adapters } from "@pass/integrations";
import { reconcileExecutions, type JobDeps } from "@pass/worker";

/**
 * Stage G (mock), Tasks 1–2: simulated executions close deterministically
 * against the live mid and their referenced Pass-version snapshot, and the
 * first close carries onto the Pass with a pass_events row. No Hyperliquid
 * order-status lookup runs for simulated rows; real rows keep the
 * existing HL path byte for byte.
 */
let handle: DbHandle;
let db: DbHandle["db"];

const orderStatusSpy = vi.fn();
let mids: Record<string, string> = {};

function deps(): JobDeps {
  const hyperliquid = {
    getSnapshot: async (asset: string) => ({
      provider: "hyperliquid" as const,
      asset,
      markPrice: mids[asset] ?? "0",
      midPrice: mids[asset] ?? null,
      observedAt: new Date().toISOString(),
    }),
    getOrderStatus: orderStatusSpy,
  };
  return {
    handle,
    adapters: { hyperliquid } as unknown as Adapters,
    log: () => {},
  };
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "pass-stage-g-worker-"));
  handle = await createDb({ pglitePath: dir });
  const { runMigrations } = await import("@pass/db");
  await runMigrations(handle);
  db = handle.db;
  // PGlite initialisation on a loaded machine can exceed the default 60s
  // hook budget (see AI_HANDOFF residual 5); the assertions below stay
  // strict, only setup gets headroom.
}, 180_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  await handle.close();
});
let n = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(n += 1)}`;

async function mkTrader(): Promise<string> {
  const [u] = await db.insert(users).values({}).returning();
  if (!u) throw new Error("fixture setup failed");
  return u.id;
}

async function mkPass(
  traderId: string,
  plan: { direction: "long" | "short"; entryPrice: string; takeProfit: string | null; stopLoss: string | null },
): Promise<string> {
  const tag = uniq("g");
  const [p] = await db
    .insert(passes)
    .values({
      publicId: tag,
      traderId,
      slug: `slug_${tag}`,
      version: 1,
      asset: "BTC",
      direction: plan.direction,
      entryType: "limit",
      entryPrice: plan.entryPrice,
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      leverage: "5",
      thesis: "Stage G fixture.",
      status: "active",
    })
    .returning();
  if (!p) throw new Error("fixture setup failed");
  await db.insert(passVersions).values({
    passId: p.id,
    version: 1,
    snapshot: {
      asset: "BTC",
      dex: null,
      direction: plan.direction,
      entryType: "limit",
      entryPrice: plan.entryPrice,
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      leverage: "5",
      expiresAt: null,
    },
  });
  return p.id;
}

async function mkAccount(userId: string | null): Promise<string> {
  const [a] = await db
    .insert(tradingAccounts)
    .values({
      userId,
      provider: "hyperliquid",
      accountAddress: `0x${uniq("a").replace(/[^0-9a-f]/g, "0").padEnd(40, "0").slice(0, 40)}`,
      isPrimary: false,
    })
    .returning();
  if (!a) throw new Error("fixture setup failed");
  return a.id;
}

async function mkExecution(opts: {
  passId: string;
  accountId: string;
  takerId: string | null;
  simulated: boolean;
  providerOrderId: string;
  positionSize?: string;
}): Promise<string> {
  const [e] = await db
    .insert(executions)
    .values({
      passId: opts.passId,
      passVersion: 1,
      takerUserId: opts.takerId,
      accountId: opts.accountId,
      clientRequestId: uniq("req"),
      providerOrderId: opts.providerOrderId,
      providerStatus: "pending",
      simulated: opts.simulated,
      side: "buy",
      positionSize: opts.positionSize ?? "0.01",
      status: "entry_pending",
    })
    .returning();
  if (!e) throw new Error("fixture setup failed");
  return e.id;
}

async function row(id: string) {
  const rows = await db.select().from(executions).where(eq(executions.id, id)).limit(1);
  return rows[0]!;
}

describe("reconcileExecutions over simulated rows (Task 1)", () => {
  it("closes a long as tp_hit with positive non-zero PnL and never calls HL", async () => {
    const trader = await mkTrader();
    const passId = await mkPass(trader, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
    });
    const execId = await mkExecution({
      passId,
      accountId: await mkAccount(null),
      takerId: null,
      simulated: true,
      providerOrderId: `mock_${uniq("m")}`,
    });
    mids = { BTC: "117000" };
    orderStatusSpy.mockClear();
    // Denylist, not a blanket stub: stubbing global fetch before PGlite
    // initialises starves it (it loads through fetch), so Hyperliquid
    // URLs throw while everything else delegates to the real fetch.
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown, init?: unknown) => {
        if (String(url).includes("hyperliquid")) {
          throw new Error("hyperliquid must not be called for simulated rows");
        }
        return realFetch(url as string, init as never);
      }),
    );
    let affected = 0;
    try {
      affected = await reconcileExecutions(deps());
    } finally {
      vi.unstubAllGlobals();
    }

    expect(affected).toBeGreaterThanOrEqual(1);
    const e = await row(execId);
    expect(e.providerStatus).toBe("tp_hit");
    expect(e.status).toBe("tp_hit");
    expect(e.closedAt).not.toBeNull();
    expect(e.actualEntry).toBe("116000");
    expect(e.realizedPnl).toBe("26");
    expect(Number(e.realizedPnl)).toBeGreaterThan(0);
    // The dangerous regression: the mock branch must never consult HL.
    expect(orderStatusSpy).not.toHaveBeenCalled();
  });

  it("closes a short as sl_hit with negative PnL", async () => {
    const trader = await mkTrader();
    const passId = await mkPass(trader, {
      direction: "short",
      entryPrice: "113400",
      takeProfit: "111900",
      stopLoss: "116000",
    });
    const execId = await mkExecution({
      passId,
      accountId: await mkAccount(null),
      takerId: null,
      simulated: true,
      providerOrderId: `mock_${uniq("m")}`,
    });
    mids = { BTC: "116500" };

    await reconcileExecutions(deps());

    const e = await row(execId);
    expect(e.providerStatus).toBe("sl_hit");
    expect(e.status).toBe("sl_hit");
    expect(e.actualEntry).toBe("116000");
    expect(Number(e.realizedPnl)).toBeLessThan(0);
  });

  it("leaves the execution open while the mid sits between the legs", async () => {
    const trader = await mkTrader();
    const passId = await mkPass(trader, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
    });
    const execId = await mkExecution({
      passId,
      accountId: await mkAccount(null),
      takerId: null,
      simulated: true,
      providerOrderId: `mock_${uniq("m")}`,
    });
    mids = { BTC: "114000" };

    await reconcileExecutions(deps());

    const e = await row(execId);
    expect(e.closedAt).toBeNull();
    expect(e.providerStatus).toBe("pending");
    expect(e.status).toBe("entry_pending");
  });

  it("sends real rows through the existing HL path unchanged", async () => {
    const trader = await mkTrader();
    const passId = await mkPass(trader, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
    });
    const execId = await mkExecution({
      passId,
      accountId: await mkAccount(trader),
      takerId: trader,
      simulated: false,
      providerOrderId: "123456",
    });
    mids = { BTC: "117000" };
    orderStatusSpy.mockClear();
    orderStatusSpy.mockResolvedValue({
      status: "filled",
      orderId: "123456",
      oid: 123456,
      filled: true,
      avgPx: "113500",
      totalSz: "0.01",
    });

    await reconcileExecutions(deps());

    expect(orderStatusSpy).toHaveBeenCalledWith("123456");
    const e = await row(execId);
    expect(e.providerStatus).toBe("filled");
    expect(e.actualEntry).toBe("113500");
    // The mock close never ran for this row: no outcome status, no PnL.
    expect(e.status).not.toMatch(/tp_hit|sl_hit/);
    expect(e.closedAt).toBeNull();
  });
});

describe("Pass lifecycle on simulated close (Task 2)", () => {
  it("transitions the Pass on first close and writes the event row", async () => {
    const trader = await mkTrader();
    const passId = await mkPass(trader, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
    });
    await mkExecution({
      passId,
      accountId: await mkAccount(null),
      takerId: null,
      simulated: true,
      providerOrderId: `mock_${uniq("m")}`,
    });
    mids = { BTC: "117000" };

    await reconcileExecutions(deps());

    const [p] = await db.select().from(passes).where(eq(passes.id, passId)).limit(1);
    expect(p!.status).toBe("tp_hit");
    const events = await db.select().from(passEvents).where(eq(passEvents.passId, passId));
    const outcome = events.filter((v) => v.eventType === "tp_hit");
    expect(outcome).toHaveLength(1);
    expect(outcome[0]!.passVersion).toBe(1);
  });

  it("never rewrites a Pass that already left active", async () => {
    const trader = await mkTrader();
    const passId = await mkPass(trader, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
    });
    // First close wins the Pass…
    await mkExecution({
      passId,
      accountId: await mkAccount(null),
      takerId: null,
      simulated: true,
      providerOrderId: `mock_${uniq("m")}`,
    });
    mids = { BTC: "117000" };
    await reconcileExecutions(deps());
    // …a later losing close still closes its own row but not the Pass.
    await mkExecution({
      passId,
      accountId: await mkAccount(null),
      takerId: null,
      simulated: true,
      providerOrderId: `mock_${uniq("m")}`,
    });
    mids = { BTC: "111000" };
    await reconcileExecutions(deps());

    const [p] = await db.select().from(passes).where(eq(passes.id, passId)).limit(1);
    expect(p!.status).toBe("tp_hit");
    const events = await db.select().from(passEvents).where(eq(passEvents.passId, passId));
    expect(events.filter((v) => v.eventType === "tp_hit")).toHaveLength(1);
    expect(events.filter((v) => v.eventType === "sl_hit")).toHaveLength(0);
  });
});
