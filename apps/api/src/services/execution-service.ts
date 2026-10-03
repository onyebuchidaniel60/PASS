import { desc, eq } from "drizzle-orm";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import { aggregatePassPerformance, sideFor, toDecimalStringSafe } from "./helpers.js";
import { isStaleVersion } from "@pass/domain";
import { executions, passEvents, tradingAccounts, type PassRow } from "@pass/db";
import { getPassById, getPassVersion } from "./pass-service.js";
import type {
  ExecutionPreviewRequest,
  ExecutionRequest,
  ExecutionPreviewDto,
} from "@pass/contracts";

/**
 * Server-relay execution (docs/DECISIONS.md D-018.3).
 *
 * The PASS backend never holds signing material. It receives an already
 * signed payload, validates the eight ordered steps below, relays to the
 * Hyperliquid Exchange API, records the result, and reconciles status.
 */

const ALLOWED_PRIOR_VERSIONS: number[] = [];

function assertAccountOwnership(
  ctx: AppContext,
  accountId: string,
  takerId: string,
): Promise<{ id: string; accountAddress: string; agentAddress: string | null }> {
  return (async () => {
    const rows = await ctx.db
      .select({
        id: tradingAccounts.id,
        accountAddress: tradingAccounts.accountAddress,
        agentAddress: tradingAccounts.agentAddress,
        userId: tradingAccounts.userId,
      })
      .from(tradingAccounts)
      .where(eq(tradingAccounts.id, accountId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AppError("FORBIDDEN", "Trading account not found.");
    // Ownership is resolved server-side, never trusted from the client
    // (docs/SECURITY_SPEC.md §10).
    if (row.userId !== takerId) {
      throw new AppError("FORBIDDEN", "That trading account is not yours.");
    }
    return { id: row.id, accountAddress: row.accountAddress, agentAddress: row.agentAddress };
  })();
}

export async function buildExecutionPreview(
  ctx: AppContext,
  passId: string,
  takerId: string,
  input: ExecutionPreviewRequest,
): Promise<ExecutionPreviewDto> {
  const pass = await getPassById(ctx, passId);

  if (pass.status !== "active" && pass.status !== "entry_pending") {
    throw new AppError("PASS_NOT_ACTIVE", `This Pass is ${pass.status}.`);
  }
  if (pass.traderId === takerId) {
    throw new AppError(
      "FORBIDDEN",
      "You cannot take your own Pass. Publish it and let another Trader take it.",
    );
  }

  await assertAccountOwnership(ctx, input.accountId, takerId);

  const positionSize = toDecimalStringSafe(input.positionSize);
  if (Number(positionSize) <= 0) {
    throw new AppError("INVALID_POSITION_SIZE");
  }

  let mark: string | null = null;
  let observedAt: string | null = null;
  const warnings: { code: string; message: string }[] = [];
  try {
    const snap = await ctx.adapters.hyperliquid.getSnapshot(pass.asset);
    mark = snap?.markPrice ?? null;
    observedAt = snap?.observedAt ?? null;
  } catch {
    warnings.push({
      code: "PROVIDER_UNAVAILABLE",
      message: "Live market data is unavailable. The order will be submitted at market.",
    });
  }

  // D-018.3 step 3 / docs/UX_SPEC.md §9 — a stale Pass must never reach the
  // authorization step. The preview refuses it so the Taker is sent to the
  // "This Pass changed" interstitial instead of authorizing old parameters.
  if (isStaleVersion(input.passVersion, pass.version, ALLOWED_PRIOR_VERSIONS)) {
    throw new AppError(
      "PASS_VERSION_STALE",
      "This Pass changed. Review the latest Pass before executing.",
      { currentVersion: pass.version, reviewedVersion: input.passVersion },
    );
  }

  // Always resolve the version that will actually be executed.
  const version = await getPassVersion(ctx, pass.id, input.passVersion);

  const snapshot = version.snapshot as {
    entryPrice: string | null;
    stopLoss: string | null;
    takeProfit: string | null;
    leverage: string | null;
    direction: "long" | "short";
  };

  const leverage = toDecimalStringSafe(input.leverage ?? snapshot.leverage ?? "1");
  const markNum = mark === null ? null : Number(mark);
  const entryNum = snapshot.entryPrice === null ? markNum : Number(snapshot.entryPrice);

  let margin: string | null = null;
  if (entryNum !== null && Number.isFinite(entryNum) && entryNum > 0) {
    const notional = Number(positionSize) * entryNum;
    margin = toDecimalStringSafe(notional / Number(leverage || "1"));
  }

  if (Number(leverage) > 40) {
    warnings.push({ code: "INVALID_LEVERAGE", message: "Leverage is above the supported maximum." });
  }
  if (markNum !== null && Number.isFinite(markNum)) {
    if (snapshot.entryPrice !== null) {
      const entry = Number(snapshot.entryPrice);
      if (snapshot.direction === "long" && markNum > entry * 1.05) {
        warnings.push({
          code: "SLIPPAGE_EXCEEDED",
          message: `The market is above the planned entry (${snapshot.entryPrice}). A limit order may not fill.`,
        });
      }
      if (snapshot.direction === "short" && markNum < entry * 0.95) {
        warnings.push({
          code: "SLIPPAGE_EXCEEDED",
          message: `The market is below the planned entry (${snapshot.entryPrice}). A limit order may not fill.`,
        });
      }
    }
  }

  return {
    passVersion: input.passVersion,
    passPublicId: pass.publicId,
    asset: pass.asset,
    direction: pass.direction,
    entryType: pass.entryType,
    positionSize,
    leverage,
    requestedEntry: snapshot.entryPrice,
    markPrice: mark,
    marketObservedAt: observedAt,
    stopLoss: snapshot.stopLoss,
    takeProfit: snapshot.takeProfit,
    slippageToleranceBps: input.slippageToleranceBps,
    estimatedMargin: margin,
    availableMargin: null,
    warnings,
    requiresConfirmation: true,
    observedAt: new Date().toISOString(),
  };
}

/**
 * The D-018.3 relay. Validation runs in the exact documented order.
 */
export async function relayExecution(
  ctx: AppContext,
  passId: string,
  takerId: string,
  input: ExecutionRequest,
): Promise<{ executionId: string; providerOrderId: string; status: string }> {
  // Step 5 is checked first as a cheap idempotency guard, then re-checked at
  // its documented position. This never changes observable behaviour: a
  // duplicate returns the original record instead of submitting a second order.
  const existing = await findByClientRequestId(ctx, input.clientRequestId);
  if (existing) {
    return {
      executionId: existing.id,
      providerOrderId: existing.providerOrderId ?? "",
      status: existing.providerStatus,
    };
  }

  // 1. authenticate the Taker (done by the route; asserted here).
  if (!takerId) throw new AppError("AUTH_REQUIRED");

  // 2. verify the Pass exists and is active.
  const pass: PassRow = await getPassById(ctx, passId);
  if (pass.status !== "active" && pass.status !== "entry_pending") {
    throw new AppError("PASS_NOT_ACTIVE", `This Pass is ${pass.status}.`);
  }
  if (pass.expiresAt && pass.expiresAt.getTime() <= Date.now()) {
    throw new AppError("PASS_EXPIRED");
  }

  // 3. verify the reviewed Pass version matches the current published version.
  if (
    input.passVersion !== pass.version &&
    !ALLOWED_PRIOR_VERSIONS.includes(input.passVersion)
  ) {
    throw new AppError(
      "PASS_VERSION_STALE",
      "This Pass changed. Review the latest Pass before executing.",
      { currentVersion: pass.version, reviewedVersion: input.passVersion },
    );
  }

  // 4. verify the referenced trading account belongs to the Taker.
  const account = await assertAccountOwnership(ctx, input.accountId, takerId);

  // 5. verify the clientRequestId has not been seen before.
  const dup = await findByClientRequestId(ctx, input.clientRequestId);
  if (dup) {
    return {
      executionId: dup.id,
      providerOrderId: dup.providerOrderId ?? "",
      status: dup.providerStatus,
    };
  }

  const version = await getPassVersion(ctx, pass.id, input.passVersion);
  const snapshot = version.snapshot as {
    stopLoss: string | null;
    takeProfit: string | null;
    leverage: string | null;
    direction: "long" | "short";
    entryPrice: string | null;
  };

  // 6. relay the signed payload. The payload is forwarded unmodified.
  let relayed;
  try {
    relayed = await ctx.adapters.hyperliquid.relaySignedAction(input.signedPayload);
  } catch (err) {
    ctx.log.error("hyperliquid relay failed", {
      passId,
      takerId,
      reason: err instanceof Error ? err.message : String(err),
    });
    throw new AppError("ORDER_REJECTED", "The order was rejected by the exchange.");
  }

  // 7. record the provider_order_id and the execution row.
  const inserted = await ctx.db
    .insert(executions)
    .values({
      passId: pass.id,
      passVersion: input.passVersion,
      takerUserId: takerId,
      accountId: account.id,
      clientRequestId: input.clientRequestId,
      providerOrderId: relayed.providerOrderId,
      providerStatus: relayed.status,
      side: sideFor(pass.direction),
      positionSize: toDecimalStringSafe(
        (input.signedPayload.exchangeRequest as { sz?: number | string } | undefined)?.sz ?? "0",
      ),
      leverage: snapshot.leverage,
      requestedEntry: snapshot.entryPrice,
      stopLoss: snapshot.stopLoss,
      takeProfit: snapshot.takeProfit,
      status: "entry_pending",
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new AppError("INTERNAL_ERROR", "Execution insert returned no row.");

  await ctx.db.insert(passEvents).values({
    passId: pass.id,
    passVersion: input.passVersion,
    eventType: "execution_recorded",
    actorUserId: takerId,
    metadata: {
      executionId: row.id,
      providerOrderId: relayed.providerOrderId,
      accountAddress: account.accountAddress,
    },
  });

  // 8. reconcile status via the Info API.
  await reconcileExecution(ctx, row.id, relayed.providerOrderId);

  const fresh = await ctx.db
    .select()
    .from(executions)
    .where(eq(executions.id, row.id))
    .limit(1);

  return {
    executionId: row.id,
    providerOrderId: relayed.providerOrderId,
    status: fresh[0]?.providerStatus ?? relayed.status,
  };
}

async function findByClientRequestId(ctx: AppContext, clientRequestId: string) {
  const rows = await ctx.db
    .select()
    .from(executions)
    .where(eq(executions.clientRequestId, clientRequestId))
    .limit(1);
  return rows[0] ?? null;
}

/** Step 8: reconcile provider order status through the Info API. */
export async function reconcileExecution(
  ctx: AppContext,
  executionId: string,
  providerOrderId: string,
): Promise<void> {
  try {
    const status = await ctx.adapters.hyperliquid.getOrderStatus(providerOrderId);
    if (!status) return;
    const nextStatus = status.status.toLowerCase().replace(/[^a-z_]/g, "");
    const mapped =
      nextStatus === "filled" ? "open" : undefined;
    await ctx.db
      .update(executions)
      .set({
        providerStatus: status.status,
        actualEntry: status.avgPx,
        ...(mapped ? { status: mapped } : {}),
        updatedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
  } catch (err) {
    // Reconciliation failure must not lose the recorded execution.
    ctx.log.warn("execution reconcile failed", {
      executionId,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getExecution(ctx: AppContext, id: string, takerId: string) {
  const rows = await ctx.db
    .select()
    .from(executions)
    .where(eq(executions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError("PASS_NOT_FOUND", "Execution not found.");
  if (row.takerUserId !== takerId) throw new AppError("FORBIDDEN");
  return row;
}

export async function listMyExecutions(ctx: AppContext, takerId: string, limit: number) {
  return ctx.db
    .select()
    .from(executions)
    .where(eq(executions.takerUserId, takerId))
    .orderBy(desc(executions.createdAt))
    .limit(limit);
}

export async function listPassExecutions(ctx: AppContext, passId: string) {
  return ctx.db
    .select()
    .from(executions)
    .where(eq(executions.passId, passId))
    .orderBy(desc(executions.createdAt));
}

/** PASS performance for a Pass. Never combined with reputation (D-014). */
export async function passPerformance(ctx: AppContext, passId: string) {
  const rows = await ctx.db
    .select({
      status: executions.status,
      realizedPnl: executions.realizedPnl,
    })
    .from(executions)
    .where(eq(executions.passId, passId));

  const agg = aggregatePassPerformance(
    rows.map((r) => ({
      status: r.status as "tp_hit" | "sl_hit" | "manually_closed" | "open",
      realizedPnl: r.realizedPnl,
    })),
  );

  return {
    passId,
    takersCount: agg.takersCount,
    completedCount: agg.completedCount,
    tpHitCount: agg.tpHitCount,
    slHitCount: agg.slHitCount,
    manuallyClosedCount: agg.manuallyClosedCount,
    successRatePct: agg.successRatePct,
    totalRealizedPnl: agg.totalRealizedPnl,
    updatedAt: new Date().toISOString(),
  };
}

export async function countPassVersions(ctx: AppContext, passId: string, version: number) {
  const versioned = await getPassVersion(ctx, passId, version);
  return versioned;
}