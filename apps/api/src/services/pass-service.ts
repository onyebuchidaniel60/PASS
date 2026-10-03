import { and, desc, eq, sql } from "drizzle-orm";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import {
  buildPassSlug,
  canTransition,
  newPublicId,
  snapshotFromPlan,
  validatePlan,
} from "@pass/domain";
import {
  executions,
  passEvents,
  passVersions,
  passes,
  profiles,
  type PassRow,
} from "@pass/db";
import type { CreatePassRequest, UpdatePassRequest } from "@pass/contracts";

/**
 * Fields whose change alters what a Taker would execute. Changing any of
 * these on a live Pass must mint a new pass_versions row and a pass_events
 * row before the change is visible publicly (docs/DECISIONS.md D-018.5).
 */
export const EXECUTION_RELEVANT_FIELDS = [
  "asset",
  "direction",
  "entryType",
  "entryPrice",
  "stopLoss",
  "takeProfit",
  "leverage",
  "expiresAt",
] as const;

export type ExecutionRelevantField = (typeof EXECUTION_RELEVANT_FIELDS)[number];

export function isExecutionRelevantChange(
  current: PassRow,
  patch: Partial<UpdatePassRequest>,
): boolean {
  return EXECUTION_RELEVANT_FIELDS.some((f) => {
    if (!(f in patch)) return false;
    const next = (patch as Record<string, unknown>)[f];
    const prev = (current as unknown as Record<string, unknown>)[f];
    if (next === undefined) return false;
    return String(next ?? "") !== String(prev ?? "");
  });
}

async function getTraderSlug(ctx: AppContext, traderId: string): Promise<string> {
  const rows = await ctx.db
    .select({ slug: profiles.slug })
    .from(profiles)
    .where(eq(profiles.userId, traderId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new AppError("PROFILE_NOT_FOUND", "Create a PASS profile before creating a Pass.");
  }
  return row.slug;
}

async function assertSupportedAsset(ctx: AppContext, asset: string): Promise<void> {
  let assets: Array<{ asset: string }>;
  try {
    assets = await ctx.adapters.hyperliquid.listAssets();
  } catch {
    // Provider unavailable: do not block authoring on a market-list read.
    return;
  }
  const supported = assets.map((a) => a.asset.toUpperCase());
  if (!supported.includes(asset.toUpperCase())) {
    throw new AppError("INVALID_ASSET", `"${asset}" is not a supported market.`);
  }
}

function planFromRow(row: PassRow) {
  return {
    asset: row.asset,
    direction: row.direction,
    entryType: row.entryType,
    entryPrice: row.entryPrice,
    stopLoss: row.stopLoss,
    takeProfit: row.takeProfit,
    leverage: row.leverage,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

export async function createPass(
  ctx: AppContext,
  traderId: string,
  input: CreatePassRequest,
): Promise<PassRow> {
  const traderSlug = await getTraderSlug(ctx, traderId);
  await assertSupportedAsset(ctx, input.asset);

  const plan = {
    asset: input.asset,
    direction: input.direction,
    entryType: input.entryType,
    entryPrice: input.entryPrice ?? null,
    stopLoss: input.stopLoss ?? null,
    takeProfit: input.takeProfit ?? null,
    leverage: input.leverage ?? null,
    expiresAt: input.expiresAt ?? null,
  };

  const failures = validatePlan(plan);
  if (failures.length > 0) {
    throw new AppError("INVALID_PRICE", failures[0]!.message, { failures });
  }

  const publicId = newPublicId();
  const slug = buildPassSlug({
    traderSlug,
    asset: input.asset,
    direction: input.direction,
  });

  const inserted = await ctx.db
    .insert(passes)
    .values({
      publicId,
      traderId,
      slug,
      version: 1,
      asset: input.asset.toUpperCase(),
      dex: null,
      direction: input.direction,
      entryType: input.entryType,
      entryPrice: plan.entryPrice,
      stopLoss: plan.stopLoss,
      takeProfit: plan.takeProfit,
      leverage: plan.leverage,
      thesis: input.thesis,
      status: "draft",
      expiresAt: plan.expiresAt ? new Date(plan.expiresAt) : null,
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new AppError("INTERNAL_ERROR", "Pass insert returned no row.");

  // Version 1 snapshot exists from creation so an execution can always resolve.
  await ctx.db.insert(passVersions).values({
    passId: row.id,
    version: 1,
    snapshot: snapshotFromPlan(plan, row.asset, row.dex),
    createdBy: traderId,
  });

  await ctx.db.insert(passEvents).values({
    passId: row.id,
    passVersion: 1,
    eventType: "created",
    actorUserId: traderId,
    metadata: { asset: row.asset, direction: row.direction },
  });

  return row;
}

export async function getPassById(ctx: AppContext, id: string): Promise<PassRow> {
  const rows = await ctx.db.select().from(passes).where(eq(passes.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new AppError("PASS_NOT_FOUND");
  return row;
}

export async function getPassByPublicId(
  ctx: AppContext,
  publicId: string,
): Promise<PassRow> {
  const rows = await ctx.db
    .select()
    .from(passes)
    .where(eq(passes.publicId, publicId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError("PASS_NOT_FOUND");
  return row;
}

/**
 * Applies an edit. When the Pass is live and an execution-relevant field
 * changes, a new version and a new event are written in the same transaction
 * so history is never silently rewritten (D-018.5).
 */
export async function updatePass(
  ctx: AppContext,
  passId: string,
  traderId: string,
  patch: UpdatePassRequest,
): Promise<PassRow> {
  const current = await getPassById(ctx, passId);

  if (current.traderId !== traderId) {
    throw new AppError("FORBIDDEN", "Only the owning Trader can edit this Pass.");
  }
  if (current.status !== "draft" && current.status !== "active" && current.status !== "entry_pending") {
    throw new AppError("PASS_NOT_ACTIVE", `A ${current.status} Pass cannot be edited.`);
  }
  if (patch.version !== current.version) {
    throw new AppError("PASS_VERSION_STALE", "This Pass changed. Reload before editing.", {
      currentVersion: current.version,
      yourVersion: patch.version,
    });
  }

  const nextPlan = {
    asset: (patch.asset ?? current.asset).toUpperCase(),
    direction: patch.direction ?? current.direction,
    entryType: patch.entryType ?? current.entryType,
    entryPrice: patch.entryPrice !== undefined ? patch.entryPrice : current.entryPrice,
    stopLoss: patch.stopLoss !== undefined ? patch.stopLoss : current.stopLoss,
    takeProfit: patch.takeProfit !== undefined ? patch.takeProfit : current.takeProfit,
    leverage: patch.leverage !== undefined ? patch.leverage : current.leverage,
    expiresAt:
      patch.expiresAt !== undefined
        ? patch.expiresAt
        : current.expiresAt
          ? current.expiresAt.toISOString()
          : null,
  };

  const failures = validatePlan(nextPlan);
  if (failures.length > 0) {
    throw new AppError("INVALID_PRICE", failures[0]!.message, { failures });
  }
  if (patch.asset) await assertSupportedAsset(ctx, patch.asset);

  const needsNewVersion = isExecutionRelevantChange(current, patch);
  const nextVersion = needsNewVersion ? current.version + 1 : current.version;

  const updated = await ctx.db
    .update(passes)
    .set({
      asset: nextPlan.asset,
      direction: nextPlan.direction,
      entryType: nextPlan.entryType,
      entryPrice: nextPlan.entryPrice,
      stopLoss: nextPlan.stopLoss,
      takeProfit: nextPlan.takeProfit,
      leverage: nextPlan.leverage,
      expiresAt: nextPlan.expiresAt ? new Date(nextPlan.expiresAt) : null,
      thesis: patch.thesis ?? current.thesis,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(passes.id, passId))
    .returning();

  const row = updated[0];
  if (!row) throw new AppError("INTERNAL_ERROR", "Pass update returned no row.");

  if (needsNewVersion) {
    await ctx.db.insert(passVersions).values({
      passId: passId,
      version: nextVersion,
      snapshot: snapshotFromPlan(nextPlan, row.asset, row.dex),
      createdBy: traderId,
    });
  }

  await ctx.db.insert(passEvents).values({
    passId,
    passVersion: nextVersion,
    eventType: "updated",
    actorUserId: traderId,
    metadata: {
      newVersion: nextVersion,
      versionedFields: needsNewVersion ? changedFields(current, patch) : [],
    },
  });

  return row;
}

function changedFields(current: PassRow, patch: Partial<UpdatePassRequest>): string[] {
  const out: string[] = [];
  for (const f of EXECUTION_RELEVANT_FIELDS) {
    if (!(f in patch)) continue;
    const next = (patch as Record<string, unknown>)[f];
    if (next === undefined) continue;
    const prev = (current as unknown as Record<string, unknown>)[f];
    if (String(next ?? "") !== String(prev ?? "")) out.push(f);
  }
  return out;
}

export async function publishPass(
  ctx: AppContext,
  passId: string,
  traderId: string,
): Promise<PassRow> {
  const row = await getPassById(ctx, passId);
  if (row.traderId !== traderId) throw new AppError("FORBIDDEN");
  if (!canTransition(row.status, "active")) {
    throw new AppError("PASS_NOT_ACTIVE", `A ${row.status} Pass cannot be published.`);
  }

  const failures = validatePlan(planFromRow(row));
  if (failures.length > 0) {
    throw new AppError("INVALID_PRICE", failures[0]!.message, { failures });
  }
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    throw new AppError("PASS_EXPIRED", "This Pass expiry is in the past.");
  }

  const updated = await ctx.db
    .update(passes)
    .set({ status: "active", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(passes.id, passId))
    .returning();

  const out = updated[0];
  if (!out) throw new AppError("INTERNAL_ERROR");

  await ctx.db.insert(passEvents).values({
    passId,
    passVersion: out.version,
    eventType: "published",
    actorUserId: traderId,
    metadata: { publicId: out.publicId, canonicalPath: `/p/${out.publicId}` },
  });

  return out;
}

export async function cancelPass(
  ctx: AppContext,
  passId: string,
  traderId: string,
): Promise<PassRow> {
  const row = await getPassById(ctx, passId);
  if (row.traderId !== traderId) throw new AppError("FORBIDDEN");
  if (!canTransition(row.status, "cancelled")) {
    throw new AppError("PASS_CANCELLED", `A ${row.status} Pass cannot be cancelled.`);
  }

  const updated = await ctx.db
    .update(passes)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(passes.id, passId))
    .returning();

  const out = updated[0];
  if (!out) throw new AppError("INTERNAL_ERROR");

  await ctx.db.insert(passEvents).values({
    passId,
    passVersion: out.version,
    eventType: "cancelled",
    actorUserId: traderId,
    metadata: {},
  });

  return out;
}

/** Resolves the immutable snapshot an execution references (D-018.5). */
export async function getPassVersion(
  ctx: AppContext,
  passId: string,
  version: number,
): Promise<{ passId: string; version: number; snapshot: unknown }> {
  const rows = await ctx.db
    .select()
    .from(passVersions)
    .where(and(eq(passVersions.passId, passId), eq(passVersions.version, version)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new AppError(
      "PASS_VERSION_STALE",
      `Version ${version} is not available for this Pass.`,
    );
  }
  return { passId: row.passId, version: row.version, snapshot: row.snapshot };
}

export async function listOwnedPasses(
  ctx: AppContext,
  traderId: string,
  limit: number,
): Promise<PassRow[]> {
  return ctx.db
    .select()
    .from(passes)
    .where(eq(passes.traderId, traderId))
    .orderBy(desc(passes.createdAt))
    .limit(limit);
}

export async function listPublicPasses(
  ctx: AppContext,
  opts: { status?: string | null; limit: number; traderId?: string | null },
): Promise<PassRow[]> {
  const conditions = [];
  if (opts.status) conditions.push(eq(passes.status, opts.status as PassRow["status"]));
  if (opts.traderId) conditions.push(eq(passes.traderId, opts.traderId));

  const query = ctx.db
    .select()
    .from(passes)
    .where(
      conditions.length > 0
        ? and(...conditions)
        : sql`status in ('active','entry_pending','open','tp_hit','sl_hit','manually_closed')`,
    )
    .orderBy(desc(passes.publishedAt))
    .limit(opts.limit);

  return query;
}

export async function listPassEvents(ctx: AppContext, passId: string) {
  return ctx.db
    .select()
    .from(passEvents)
    .where(eq(passEvents.passId, passId))
    .orderBy(desc(passEvents.eventAt))
    .limit(100);
}

export async function countExecutions(ctx: AppContext, passId: string) {
  const rows = await ctx.db
    .select({ id: executions.id })
    .from(executions)
    .where(eq(executions.passId, passId));
  return rows.length;
}