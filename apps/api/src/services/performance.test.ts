import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  executions,
  passes,
  passVersions,
  profiles,
  tradingAccounts,
  users,
  type DbHandle,
} from "@pass/db";
import { traderPerformance } from "./performance.js";
import type { AppContext } from "../context.js";

/**
 * Stage G, Task 3: trader-level aggregation over simulated executions.
 * Same domain math as the per-Pass path; the `simulated` flag labels the
 * data source and never changes the computation.
 */
let handle: DbHandle;
let db: DbHandle["db"];

function ctx(): AppContext {
  return { db } as unknown as AppContext;
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "pass-stage-g-perf-"));
  handle = await createDb({ pglitePath: dir });
  const { runMigrations } = await import("@pass/db");
  await runMigrations(handle);
  db = handle.db;
  // Same headroom rationale as stage-g.test.ts (AI_HANDOFF residual 5).
}, 180_000);

afterAll(async () => {
  await handle.close();
});

let n = 0;
const uniq = (p: string) => `${p}_${Date.now().toString(36)}_${(n += 1)}`;

async function mkTrader(): Promise<{ id: string; slug: string }> {
  const [u] = await db.insert(users).values({}).returning();
  if (!u) throw new Error("fixture setup failed");
  const slug = `perf_${uniq("t").replace(/[^a-z0-9]/g, "").slice(0, 20)}`;
  await db.insert(profiles).values({ userId: u.id, slug, name: "Perf", bio: null });
  return { id: u.id, slug };
}

async function mkPass(
  traderId: string,
  plan: {
    direction: "long" | "short";
    entryPrice: string;
    takeProfit: string | null;
    stopLoss: string | null;
    status: "active" | "tp_hit" | "sl_hit";
  },
): Promise<string> {
  const tag = uniq("p");
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
      thesis: "Perf fixture.",
      status: plan.status,
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
  status: "tp_hit" | "sl_hit" | "entry_pending";
  realizedPnl: string | null;
  simulated: boolean;
  positionSize?: string;
}): Promise<void> {
  await db.insert(executions).values({
    passId: opts.passId,
    passVersion: 1,
    takerUserId: null,
    accountId: opts.accountId,
    clientRequestId: uniq("req"),
    providerOrderId: opts.simulated ? `mock_${uniq("m")}` : "999001",
    providerStatus: opts.status === "entry_pending" ? "pending" : opts.status,
    simulated: opts.simulated,
    side: "buy",
    positionSize: opts.positionSize ?? "0.01",
    status: opts.status,
    actualEntry: opts.status === "entry_pending" ? null : "116000",
    realizedPnl: opts.realizedPnl,
    closedAt: opts.status === "entry_pending" ? null : new Date(),
  });
}

describe("traderPerformance (Task 3)", () => {
  it("aggregates mixed outcomes with a simulated flag", async () => {
    const t = await mkTrader();
    const acct = await mkAccount(null);
    const passA = await mkPass(t.id, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
      status: "tp_hit",
    });
    const passB = await mkPass(t.id, {
      direction: "short",
      entryPrice: "113400",
      takeProfit: "111900",
      stopLoss: "116000",
      status: "sl_hit",
    });
    await mkExecution({ passId: passA, accountId: acct, status: "tp_hit", realizedPnl: "26", simulated: true });
    await mkExecution({ passId: passA, accountId: acct, status: "entry_pending", realizedPnl: null, simulated: true });
    await mkExecution({ passId: passB, accountId: acct, status: "sl_hit", realizedPnl: "-26", simulated: true });

    const perf = await traderPerformance(ctx(), t.slug);

    expect(perf.publishedPasses).toBe(2);
    expect(perf.completedPasses).toBe(2);
    expect(perf.passSuccessMetric).toBe(50);
    expect(perf.successMetricWindow).toBe("all time");
    expect(perf.averageRMultiple).toBe(0.37);
    expect(perf.totalRealizedPnl).toBe("0");
    expect(perf.simulated).toBe(true);
  });

  it("returns zeros and nulls without crashing for zero executions", async () => {
    const t = await mkTrader();
    await mkPass(t.id, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
      status: "active",
    });

    const perf = await traderPerformance(ctx(), t.slug);

    expect(perf.publishedPasses).toBe(1);
    expect(perf.completedPasses).toBe(0);
    expect(perf.passSuccessMetric).toBeNull();
    expect(perf.averageRMultiple).toBeNull();
    expect(perf.totalRealizedPnl).toBeNull();
    expect(perf.simulated).toBeNull();
  });

  it("reports simulated false when any contributing execution is real", async () => {
    const t = await mkTrader();
    const acct = await mkAccount(t.id);
    const passId = await mkPass(t.id, {
      direction: "long",
      entryPrice: "113400",
      takeProfit: "116000",
      stopLoss: "111900",
      status: "tp_hit",
    });
    await mkExecution({ passId, accountId: acct, status: "tp_hit", realizedPnl: "26", simulated: true });
    await mkExecution({ passId, accountId: acct, status: "tp_hit", realizedPnl: "26", simulated: false });

    const perf = await traderPerformance(ctx(), t.slug);

    expect(perf.simulated).toBe(false);
    expect(perf.passSuccessMetric).toBe(100);
  });
});
