import { desc, eq, inArray, ne } from "drizzle-orm";

import type { HomeActivityDto, HomeDto, HomeTraderDto } from "@pass/contracts";
import { executions, passes, profiles } from "@pass/db";
import type { AppContext } from "../context.js";

/**
 * The public homepage feed.
 *
 * Read-only. It projects the same public Pass rows the Discover page shows and
 * the same closed-execution math the profile page uses, so the homepage cannot
 * invent a second version of a trader's record.
 *
 * A trader is eligible for Top Traders only after a completed execution. A
 * profile with published Passes but no completed takes has no performance
 * record to rank, and showing one would be a claim the data does not support.
 */

const COMPLETED = new Set(["tp_hit", "sl_hit", "manually_closed"]);
const MAX_PUBLIC_PASSES = 200;
const MAX_EXECUTIONS = 2_000;
const TOP_TRADER_LIMIT = 5;
const ACTIVITY_LIMIT = 8;
const SPARKLINE_POINTS = 14;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function numeric(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cumulativeSparkline(
  rows: Array<{ realizedPnl: string | null }>,
): number[] {
  let running = 0;
  const points = rows.map((row) => {
    running += numeric(row.realizedPnl) ?? 0;
    return round2(running);
  });
  // The baseline makes a one-execution series readable without implying a
  // flat period that was never observed.
  return [0, ...points].slice(-SPARKLINE_POINTS);
}

export async function getHomeFeed(ctx: AppContext): Promise<HomeDto> {
  const passRows = await ctx.db
    .select({ pass: passes, profile: profiles })
    .from(passes)
    .innerJoin(profiles, eq(passes.traderId, profiles.userId))
    .where(ne(passes.status, "draft"))
    .orderBy(desc(passes.publishedAt), desc(passes.createdAt))
    .limit(MAX_PUBLIC_PASSES);

  const passIds = passRows.map((row) => row.pass.id);
  const executionRows =
    passIds.length === 0
      ? []
      : await ctx.db
          .select()
          .from(executions)
          .where(inArray(executions.passId, passIds))
          .orderBy(desc(executions.createdAt))
          .limit(MAX_EXECUTIONS);

  const passById = new Map(passRows.map((row) => [row.pass.id, row]));
  const executionsByPass = new Map<string, typeof executionRows>();
  for (const execution of executionRows) {
    const list = executionsByPass.get(execution.passId) ?? [];
    list.push(execution);
    executionsByPass.set(execution.passId, list);
  }

  const byTrader = new Map<
    string,
    {
      profile: (typeof passRows)[number]["profile"];
      passes: Array<(typeof passRows)[number]["pass"]>;
      executions: Array<(typeof executionRows)[number]>;
    }
  >();

  for (const row of passRows) {
    const current = byTrader.get(row.pass.traderId) ?? {
      profile: row.profile,
      passes: [],
      executions: [],
    };
    current.passes.push(row.pass);
    current.executions.push(...(executionsByPass.get(row.pass.id) ?? []));
    byTrader.set(row.pass.traderId, current);
  }

  const topTraders: HomeTraderDto[] = [];
  for (const entry of byTrader.values()) {
    const completed = entry.executions.filter((execution) =>
      COMPLETED.has(execution.status),
    );
    if (completed.length === 0) continue;

    const chronological = [...completed].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const pnl = completed.reduce(
      (sum, execution) => sum + (numeric(execution.realizedPnl) ?? 0),
      0,
    );
    const deployed = completed.reduce(
      (sum, execution) => sum + (numeric(execution.positionSize) ?? 0),
      0,
    );
    const wins = completed.filter(
      (execution) => execution.status === "tp_hit",
    ).length;

    topTraders.push({
      slug: entry.profile.slug,
      handle: entry.profile.handle,
      displayName: entry.profile.name,
      avatarUrl: entry.profile.avatarUrl,
      publishedPasses: entry.passes.length,
      activePasses: entry.passes.filter((pass) => pass.status === "active")
        .length,
      completedExecutions: completed.length,
      winRatePct: round2((wins / completed.length) * 100),
      pnlPct: deployed > 0 ? round2((pnl / deployed) * 100) : null,
      pnlUsd: String(round2(pnl)),
      sparkline: cumulativeSparkline(chronological),
    });
  }

  topTraders.sort((a, b) => {
    const pnl = (b.pnlPct ?? Number.NEGATIVE_INFINITY) -
      (a.pnlPct ?? Number.NEGATIVE_INFINITY);
    if (pnl !== 0) return pnl;
    const winRate = (b.winRatePct ?? Number.NEGATIVE_INFINITY) -
      (a.winRatePct ?? Number.NEGATIVE_INFINITY);
    if (winRate !== 0) return winRate;
    return b.completedExecutions - a.completedExecutions;
  });

  const activity: HomeActivityDto[] = [];

  for (const execution of executionRows.slice(0, 24)) {
    const row = passById.get(execution.passId);
    if (!row || !row.pass.publishedAt) continue;
    activity.push({
      id: `execution:${execution.id}`,
      kind: "execution",
      actor: {
        slug: row.profile.slug,
        handle: row.profile.handle,
        displayName: row.profile.name,
        avatarUrl: row.profile.avatarUrl,
      },
      pass: {
        publicId: row.pass.publicId,
        asset: row.pass.asset,
        direction: row.pass.direction,
        status: execution.status,
      },
      at: execution.createdAt.toISOString(),
      sizeUsd: execution.positionSize,
      pnlUsd: execution.realizedPnl,
    });
  }

  for (const row of passRows.slice(0, 24)) {
    if (!row.pass.publishedAt) continue;
    activity.push({
      id: `published:${row.pass.id}`,
      kind: "published",
      actor: {
        slug: row.profile.slug,
        handle: row.profile.handle,
        displayName: row.profile.name,
        avatarUrl: row.profile.avatarUrl,
      },
      pass: {
        publicId: row.pass.publicId,
        asset: row.pass.asset,
        direction: row.pass.direction,
        status: row.pass.status,
      },
      at: row.pass.publishedAt.toISOString(),
      sizeUsd: null,
      pnlUsd: null,
    });
  }

  activity.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return {
    demoMode: ctx.demoMode,
    topTraders: topTraders.slice(0, TOP_TRADER_LIMIT),
    activity: activity.slice(0, ACTIVITY_LIMIT),
  };
}
