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
  runMigrations,
  tradingAccounts,
  users,
  type DbHandle,
} from "@pass/db";
import type { AppContext } from "../context.js";
import { getHomeFeed } from "./home-service.js";

/**
 * Homepage feed: the same public Pass rows and closed-execution math as the
 * profile page, ranked without ever exposing a wallet or order payload.
 */
let handle: DbHandle;
let db: DbHandle["db"];

function ctx(): AppContext {
  return { db, demoMode: false } as unknown as AppContext;
}

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "pass-home-feed-"));
  handle = await createDb({ pglitePath: dir });
  await runMigrations(handle);
  db = handle.db;
}, 180_000);

afterAll(async () => {
  await handle.close();
});

let n = 0;
const uniq = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(n += 1)}`;

async function mkTrader(slug: string, name: string) {
  const [user] = await db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await db.insert(profiles).values({
    userId: user.id,
    slug,
    handle: slug,
    name,
    bio: "fixture",
  });
  return user.id;
}

async function mkPass(
  traderId: string,
  publicId: string,
  opts: {
    asset: string;
    direction: "long" | "short";
    status: "active" | "tp_hit";
    publishedAt: Date;
  },
) {
  const [pass] = await db
    .insert(passes)
    .values({
      publicId,
      traderId,
      slug: uniq("slug"),
      version: 1,
      asset: opts.asset,
      direction: opts.direction,
      entryType: "limit",
      entryPrice: "100",
      stopLoss: "95",
      takeProfit: "110",
      leverage: "5",
      thesis: "fixture",
      status: opts.status,
      publishedAt: opts.publishedAt,
    })
    .returning();
  if (!pass) throw new Error("fixture setup failed");
  await db.insert(passVersions).values({
    passId: pass.id,
    version: 1,
    snapshot: {
      asset: opts.asset,
      dex: null,
      direction: opts.direction,
      entryType: "limit",
      entryPrice: "100",
      stopLoss: "95",
      takeProfit: "110",
      leverage: "5",
      expiresAt: null,
    },
  });
  return pass.id;
}

async function mkAccount() {
  const [account] = await db
    .insert(tradingAccounts)
    .values({
      userId: null,
      provider: "hyperliquid",
      accountAddress: `0x${uniq("a").replace(/[^0-9a-f]/g, "0").padEnd(40, "0").slice(0, 40)}`,
      isPrimary: false,
    })
    .returning();
  if (!account) throw new Error("fixture setup failed");
  return account.id;
}

describe("getHomeFeed", () => {
  it("ranks completed traders and returns a newest-first activity tape", async () => {
    const now = Date.now();
    const trader = await mkTrader("homefeedtrader", "Home Feed Trader");
    const account = await mkAccount();
    const btc = await mkPass(trader, "HOME01", {
      asset: "BTC",
      direction: "long",
      status: "active",
      publishedAt: new Date(now - 5 * 60 * 60_000),
    });
    await mkPass(trader, "HOME02", {
      asset: "ETH",
      direction: "short",
      status: "active",
      publishedAt: new Date(now - 4 * 60 * 60_000),
    });

    const closed = [
      { status: "tp_hit" as const, pnl: "600", at: new Date(now - 3 * 60 * 60_000) },
      { status: "sl_hit" as const, pnl: "-300", at: new Date(now - 2 * 60 * 60_000) },
      { status: "tp_hit" as const, pnl: "500", at: new Date(now - 60 * 60_000) },
    ];
    for (const [index, row] of closed.entries()) {
      await db.insert(executions).values({
        passId: btc,
        passVersion: 1,
        takerUserId: null,
        accountId: account,
        clientRequestId: uniq(`req_${index}`),
        providerOrderId: uniq("order"),
        providerStatus: "filled",
        simulated: true,
        side: "buy",
        positionSize: "1000",
        leverage: "5",
        status: row.status,
        realizedPnl: row.pnl,
        openedAt: new Date(row.at.getTime() - 60 * 60_000),
        closedAt: row.at,
        createdAt: row.at,
      });
    }

    // A published Pass with no completed execution has no performance record
    // to rank, so it must not be offered as a Top Trader.
    const unproven = await mkTrader("homefeedunproven", "Unproven");
    await mkPass(unproven, "HOME03", {
      asset: "SOL",
      direction: "long",
      status: "active",
      publishedAt: new Date(now - 10 * 60_000),
    });

    const feed = await getHomeFeed(ctx());
    const top = feed.topTraders[0];
    expect(top).toMatchObject({
      slug: "homefeedtrader",
      publishedPasses: 2,
      activePasses: 2,
      completedExecutions: 3,
      winRatePct: 66.67,
      pnlPct: 26.67,
      pnlUsd: "800",
    });
    expect(top?.sparkline).toEqual([0, 600, 300, 800]);
    expect(feed.topTraders.map((t) => t.slug)).not.toContain("homefeedunproven");

    // Newest first: the unproven trader's publication is newest, then the
    // three executions, then the two publications from the ranked trader.
    expect(feed.activity.map((a) => a.kind)).toEqual([
      "published",
      "execution",
      "execution",
      "execution",
      "published",
      "published",
    ]);
    const latestExecution = feed.activity.find(
      (activity) => activity.kind === "execution",
    );
    expect(latestExecution).toMatchObject({
      kind: "execution",
      pass: { publicId: "HOME01", asset: "BTC", status: "tp_hit" },
      sizeUsd: "1000",
      pnlUsd: "500",
    });

    const serialized = JSON.stringify(feed);
    expect(serialized).not.toContain("0x");
    expect(serialized).not.toContain("clientRequestId");
  });
});
