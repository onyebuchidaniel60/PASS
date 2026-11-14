/**
 * Seed the homepage's public trader record.
 *
 * Creates four idempotent "agent" traders with:
 *   - a profile and X identity (handle only, no OAuth token material),
 *   - two published Hyperliquid Passes each, with v1 snapshots and events,
 *   - a deterministic execution history that produces the win rate, realized
 *     PnL, PnL percentage and cumulative sparkline shown on the homepage.
 *
 * Re-running updates the same rows by slug / public id / client request id.
 * It never deletes user data and never touches a real trader's rows.
 *
 * Usage:
 *   pnpm seed:top-traders
 *   DATABASE_URL=<postgres-url> pnpm seed:top-traders
 *   DATABASE_PGLITE_PATH=apps/api/.pglite pnpm seed:top-traders
 *
 * With no DATABASE_URL the script uses embedded PGlite. Point
 * DATABASE_PGLITE_PATH at the API's data directory when the local API was
 * started from apps/api; the default is ./.pglite relative to the cwd.
 */

import { createRequire } from "node:module";

import {
  createDb,
  executions,
  identities,
  passEvents,
  passVersions,
  passes,
  profiles,
  runMigrations,
  tradingAccounts,
  users,
  type DbHandle,
} from "../packages/db/src/index.js";

// drizzle-orm is a dependency of @pass/db, not of the repo root. Resolve it
// through that package so this script runs with plain `tsx` from the root.
const requireDb = createRequire(
  new URL("../packages/db/package.json", import.meta.url),
);
const { eq } = requireDb("drizzle-orm") as {
  eq: (...args: unknown[]) => never;
};

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const PGLITE_PATH = process.env.DATABASE_PGLITE_PATH ?? "./.pglite";
const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;

type Direction = "long" | "short";

interface PassSpec {
  publicId: string;
  slug: string;
  asset: string;
  direction: Direction;
  entryType: "limit" | "market";
  entryPrice: string | null;
  takeProfit: string;
  stopLoss: string;
  leverage: string;
  thesis: string;
  publishedHoursAgo: number;
}

interface TraderSpec {
  slug: string;
  name: string;
  handle: string;
  bio: string;
  passes: PassSpec[];
  executionCount: number;
  lossIndices: number[];
  targetPnlUsd: number;
  lossTotalUsd: number;
}

const FALLBACK_MID: Record<string, string> = {
  BTC: "113400",
  ETH: "3584",
  SOL: "178.94",
};

const TRADERS: TraderSpec[] = [
  {
    slug: "alphatrader",
    name: "AlphaTrader",
    handle: "alphatrader",
    bio: "BTC and ETH momentum. I publish the plan before I take it, with the invalidation already written.",
    passes: [
      {
        publicId: "AGENT01",
        slug: "alphatrader-btc-long",
        asset: "BTC",
        direction: "long",
        entryType: "limit",
        entryPrice: "113400",
        takeProfit: "116000",
        stopLoss: "111900",
        leverage: "5",
        thesis:
          "BTC reclaimed the prior range high with spot-led volume. I want the retest, not the breakout chase. Invalidation is the range mid.",
        publishedHoursAgo: 4,
      },
      {
        publicId: "AGENT02",
        slug: "alphatrader-eth-short",
        asset: "ETH",
        direction: "short",
        entryType: "market",
        entryPrice: null,
        takeProfit: "3420",
        stopLoss: "3690",
        leverage: "3",
        thesis:
          "ETH is losing the high-time-frame trend line while BTC holds its range. A market entry keeps the risk defined if the break is real.",
        publishedHoursAgo: 19,
      },
    ],
    executionCount: 25,
    lossIndices: [3, 8, 13, 17, 21, 24],
    targetPnlUsd: 10700,
    lossTotalUsd: 2220,
  },
  {
    slug: "zentrades",
    name: "Zen",
    handle: "zentrades",
    bio: "Patience over prediction. Swing setups on majors, sized for survival first.",
    passes: [
      {
        publicId: "AGENT03",
        slug: "zentrades-sol-long",
        asset: "SOL",
        direction: "long",
        entryType: "limit",
        entryPrice: "178.94",
        takeProfit: "192.00",
        stopLoss: "169.00",
        leverage: "4",
        thesis:
          "SOL is compressing above the weekly value area. I want the first pullback that holds the prior breakout shelf.",
        publishedHoursAgo: 7,
      },
      {
        publicId: "AGENT04",
        slug: "zentrades-btc-short",
        asset: "BTC",
        direction: "short",
        entryType: "limit",
        entryPrice: "115200",
        takeProfit: "111800",
        stopLoss: "117400",
        leverage: "3",
        thesis:
          "The rally is into a supply shelf with falling perp volume. A rejection here keeps the stop tight and the target at the prior low.",
        publishedHoursAgo: 31,
      },
    ],
    executionCount: 18,
    lossIndices: [2, 6, 10, 14, 17],
    targetPnlUsd: 6480,
    lossTotalUsd: 1320,
  },
  {
    slug: "matrixtrades",
    name: "Matrix",
    handle: "matrixtrades",
    bio: "Systematic trend following across BTC, ETH and SOL. Same process every session.",
    passes: [
      {
        publicId: "AGENT05",
        slug: "matrixtrades-eth-long",
        asset: "ETH",
        direction: "long",
        entryType: "limit",
        entryPrice: "3520",
        takeProfit: "3780",
        stopLoss: "3390",
        leverage: "3",
        thesis:
          "ETH is above its 20-day trend with realized volatility falling. The plan buys the first higher low, not the candle high.",
        publishedHoursAgo: 11,
      },
      {
        publicId: "AGENT06",
        slug: "matrixtrades-sol-short",
        asset: "SOL",
        direction: "short",
        entryType: "limit",
        entryPrice: "188.40",
        takeProfit: "176.00",
        stopLoss: "194.20",
        leverage: "2",
        thesis:
          "SOL funding is stretched while price stalls under resistance. The trade is a fade with a defined reclaim level.",
        publishedHoursAgo: 43,
      },
    ],
    executionCount: 26,
    lossIndices: [2, 5, 8, 10, 13, 15, 17, 19, 21, 23, 24, 25],
    targetPnlUsd: -3250,
    lossTotalUsd: 6750,
  },
  {
    slug: "solacedoteth",
    name: "Solace",
    handle: "solacedoteth",
    bio: "Macro-aware ETH and SOL setups. No revenge trades, no moving stops.",
    passes: [
      {
        publicId: "AGENT07",
        slug: "solacedoteth-eth-long",
        asset: "ETH",
        direction: "long",
        entryType: "market",
        entryPrice: null,
        takeProfit: "3810",
        stopLoss: "3440",
        leverage: "5",
        thesis:
          "ETH is leading the majors after the range break. A market entry accepts less precision in exchange for not missing the repricing.",
        publishedHoursAgo: 2,
      },
      {
        publicId: "AGENT08",
        slug: "solacedoteth-btc-long",
        asset: "BTC",
        direction: "long",
        entryType: "limit",
        entryPrice: "112800",
        takeProfit: "118200",
        stopLoss: "109400",
        leverage: "4",
        thesis:
          "BTC is holding the weekly open while ETH leads. The plan adds on a controlled retest with the stop below the weekly structure.",
        publishedHoursAgo: 27,
      },
    ],
    executionCount: 20,
    lossIndices: [1, 5, 9, 13, 18],
    targetPnlUsd: 7900,
    lossTotalUsd: 1100,
  },
];

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Split a total into varied positive amounts that sum exactly to it. The hash
 * makes a re-run produce the same series; no Math.random anywhere.
 */
function distribute(total: number, count: number, salt: string): number[] {
  if (count === 0) return [];
  const weights = Array.from({ length: count }, (_, i) => {
    const h = hash(`${salt}:${i}`);
    return 0.7 + ((h % 61) / 100);
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map((w) => round2((total * w) / weightSum));
  const diff = round2(total - values.reduce((a, b) => a + b, 0));
  values[values.length - 1] = round2((values[values.length - 1] ?? 0) + diff);
  return values;
}

function snapshotFor(spec: PassSpec, expiresAt: Date) {
  return {
    asset: spec.asset,
    dex: null,
    marketClass: "perp",
    outcomeName: null,
    direction: spec.direction,
    entryType: spec.entryType,
    entryPrice: spec.entryPrice,
    stopLoss: spec.stopLoss,
    takeProfit: spec.takeProfit,
    leverage: spec.leverage,
    expiresAt: expiresAt.toISOString(),
  };
}

async function upsertTrader(
  db: DbHandle["db"],
  spec: TraderSpec,
): Promise<{ userId: string; passIds: string[] }> {
  const existingProfile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.slug, spec.slug))
    .limit(1);

  let userId: string;
  if (existingProfile[0]) {
    userId = existingProfile[0].userId;
    await db
      .update(profiles)
      .set({
        handle: spec.handle,
        name: spec.name,
        bio: spec.bio,
        avatarUrl: null,
        updatedAt: NOW,
      })
      .where(eq(profiles.userId, userId));
  } else {
    const insertedUser = await db.insert(users).values({}).returning();
    const user = insertedUser[0];
    if (!user) throw new Error(`Could not create user for ${spec.slug}`);
    userId = user.id;
    await db.insert(profiles).values({
      userId,
      slug: spec.slug,
      handle: spec.handle,
      name: spec.name,
      bio: spec.bio,
    });
  }

  await db
    .insert(identities)
    .values({
      userId,
      provider: "x",
      providerSubjectId: `seed_x_${spec.slug}`,
      username: spec.handle,
      displayName: spec.name,
      avatarUrl: null,
      metadata: { seeded: true, displayOnly: true },
    })
    .onConflictDoUpdate({
      target: [identities.provider, identities.providerSubjectId],
      set: {
        userId,
        username: spec.handle,
        displayName: spec.name,
        avatarUrl: null,
        metadata: { seeded: true, displayOnly: true },
        updatedAt: NOW,
      },
    });

  const passIds: string[] = [];
  for (const passSpec of spec.passes) {
    const publishedAt = new Date(
      NOW.getTime() - passSpec.publishedHoursAgo * 60 * 60 * 1000,
    );
    const expiresAt = new Date(NOW.getTime() + 30 * DAY);
    const existingPass = await db
      .select()
      .from(passes)
      .where(eq(passes.publicId, passSpec.publicId))
      .limit(1);

    let passId: string;
    if (existingPass[0]) {
      passId = existingPass[0].id;
      await db
        .update(passes)
        .set({
          traderId: userId,
          slug: passSpec.slug,
          version: 1,
          asset: passSpec.asset,
          dex: null,
          marketClass: "perp",
          outcomeName: null,
          direction: passSpec.direction,
          entryType: passSpec.entryType,
          entryPrice: passSpec.entryPrice,
          stopLoss: passSpec.stopLoss,
          takeProfit: passSpec.takeProfit,
          leverage: passSpec.leverage,
          thesis: passSpec.thesis,
          status: "active",
          validFrom: publishedAt,
          expiresAt,
          publishedAt,
          updatedAt: NOW,
        })
        .where(eq(passes.id, passId));
    } else {
      const inserted = await db
        .insert(passes)
        .values({
          publicId: passSpec.publicId,
          traderId: userId,
          slug: passSpec.slug,
          version: 1,
          asset: passSpec.asset,
          dex: null,
          marketClass: "perp",
          outcomeName: null,
          direction: passSpec.direction,
          entryType: passSpec.entryType,
          entryPrice: passSpec.entryPrice,
          stopLoss: passSpec.stopLoss,
          takeProfit: passSpec.takeProfit,
          leverage: passSpec.leverage,
          thesis: passSpec.thesis,
          status: "active",
          validFrom: publishedAt,
          expiresAt,
          publishedAt,
        })
        .returning();
      const row = inserted[0];
      if (!row) throw new Error(`Could not create Pass ${passSpec.publicId}`);
      passId = row.id;
    }
    passIds.push(passId);

    await db
      .insert(passVersions)
      .values({
        passId,
        version: 1,
        snapshot: snapshotFor(passSpec, expiresAt),
        createdBy: userId,
      })
      .onConflictDoUpdate({
        target: [passVersions.passId, passVersions.version],
        set: { snapshot: snapshotFor(passSpec, expiresAt) },
      });

    const existingEvents = await db
      .select({ eventType: passEvents.eventType })
      .from(passEvents)
      .where(eq(passEvents.passId, passId));
    const have = new Set(existingEvents.map((event) => event.eventType));
    if (!have.has("created")) {
      await db.insert(passEvents).values({
        passId,
        passVersion: 1,
        eventType: "created",
        eventAt: publishedAt,
        actorUserId: userId,
        metadata: { seeded: true, agent: true },
      });
    }
    if (!have.has("published")) {
      await db.insert(passEvents).values({
        passId,
        passVersion: 1,
        eventType: "published",
        eventAt: publishedAt,
        actorUserId: userId,
        metadata: { seeded: true, agent: true },
      });
    }
  }

  return { userId, passIds };
}

async function upsertTakerAccount(db: DbHandle["db"]): Promise<string> {
  const address = `0x${"5eed".padEnd(40, "0")}`;
  const existing = await db
    .select()
    .from(tradingAccounts)
    .where(eq(tradingAccounts.accountAddress, address))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(tradingAccounts)
    .values({
      userId: null,
      provider: "hyperliquid",
      accountAddress: address,
      agentAddress: null,
      isPrimary: false,
      isActive: true,
      venue: "mock",
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error("Could not create seed taker account");
  return row.id;
}

async function seedExecutions(
  db: DbHandle["db"],
  spec: TraderSpec,
  passSpecs: PassSpec[],
  passIds: string[],
  accountId: string,
  offsetMinutes: number,
): Promise<void> {
  const losses = new Set(spec.lossIndices);
  const winCount = spec.executionCount - spec.lossIndices.length;
  const totalWin = spec.targetPnlUsd + spec.lossTotalUsd;
  const winAmounts = distribute(totalWin, winCount, `${spec.slug}:win`);
  const lossAmounts = distribute(
    spec.lossTotalUsd,
    spec.lossIndices.length,
    `${spec.slug}:loss`,
  );
  let winCursor = 0;
  let lossCursor = 0;

  for (let i = 0; i < spec.executionCount; i += 1) {
    const passIndex = i % passIds.length;
    const passId = passIds[passIndex];
    const passSpec = passSpecs[passIndex];
    if (!passId || !passSpec) throw new Error(`Missing Pass for ${spec.slug}`);

    const isLoss = losses.has(i);
    const pnl = isLoss
      ? -1 * (lossAmounts[lossCursor++] ?? 0)
      : (winAmounts[winCursor++] ?? 0);
    const status = isLoss ? "sl_hit" : "tp_hit";
    const createdAt = new Date(
      NOW.getTime() - (i * 7 * 60 + 2 + offsetMinutes) * 60 * 1000,
    );
    const openedAt = new Date(createdAt.getTime() - 45 * 60 * 1000);
    const clientRequestId = `seed-${spec.slug}-exec-${String(i).padStart(2, "0")}`;
    const values = {
      passId,
      passVersion: 1,
      takerUserId: null,
      accountId,
      clientRequestId,
      providerOrderId: `seed-order-${spec.slug}-${String(i).padStart(2, "0")}`,
      providerStatus: "filled",
      simulated: true,
      side: passSpec.direction === "long" ? "buy" : "sell",
      positionSize: "1000",
      leverage: passSpec.leverage,
      requestedEntry: passSpec.entryPrice,
      actualEntry: passSpec.entryPrice ?? FALLBACK_MID[passSpec.asset] ?? null,
      stopLoss: passSpec.stopLoss,
      takeProfit: passSpec.takeProfit,
      status: status as "tp_hit" | "sl_hit",
      openedAt,
      closedAt: createdAt,
      realizedPnl: String(round2(pnl)),
      fees: "0",
      createdAt,
      updatedAt: createdAt,
    };

    const existing = await db
      .select({ id: executions.id })
      .from(executions)
      .where(eq(executions.clientRequestId, clientRequestId))
      .limit(1);
    if (existing[0]) {
      await db
        .update(executions)
        .set(values)
        .where(eq(executions.id, existing[0].id));
    } else {
      await db.insert(executions).values(values);
    }
  }
}

async function main(): Promise<void> {
  const handle = await createDb({
    databaseUrl: DATABASE_URL || undefined,
    pglitePath: PGLITE_PATH,
  });

  try {
    await runMigrations(handle, (message) => console.log(message));
    const db = handle.db;
    const accountId = await upsertTakerAccount(db);

    for (const [index, trader] of TRADERS.entries()) {
      const { passIds } = await upsertTrader(db, trader);
      await seedExecutions(
        db,
        trader,
        trader.passes,
        passIds,
        accountId,
        index * 3,
      );
      const pnlPct = round2(
        (trader.targetPnlUsd / (trader.executionCount * 1000)) * 100,
      );
      const winRate = round2(
        ((trader.executionCount - trader.lossIndices.length) /
          trader.executionCount) *
          100,
      );
      console.log(
        `${trader.slug}: ${trader.executionCount} closed · ${winRate.toFixed(1)}% win · ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}% PnL · /u/${trader.slug}`,
      );
    }

    console.log(`Seeded ${TRADERS.length} agent traders (${handle.kind}).`);
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error("Top-trader seed failed:", err);
  process.exitCode = 1;
});
