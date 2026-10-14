import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import { checkTakeRateLimit } from "../take-limiter.js";
import { aggregatePassPerformance, sideFor, toDecimalStringSafe } from "./helpers.js";
import { BUILDER_FEE_BPS, computeFee, isStaleVersion, splitFee } from "@pass/domain";
import { executions, feeLedger, passEvents, tradingAccounts, type PassRow } from "@pass/db";
import { getPassById, getPassVersion } from "./pass-service.js";
import { resolveTradingAccountByAddress, visibleAgentAddress } from "./profile-service.js";
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

/**
 * D-025.4 (provisional): the Take screen only ever holds the public
 * `public_id`, while these routes historically resolved the internal UUID
 * (D-018.4). Resolve internal-first, fall back to public. Ownership,
 * idempotency and status checks downstream are unchanged; unknown ids
 * still 404 as PASS_NOT_FOUND.
 */
export async function resolvePassForExecution(
  ctx: AppContext,
  idOrPublicId: string,
): Promise<PassRow> {
  // Non-UUID strings must never reach the UUID-keyed lookup: Postgres
  // raises a raw `invalid input syntax` error rather than an AppError.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrPublicId)) {
    try {
      return await getPassById(ctx, idOrPublicId);
    } catch (e) {
      if (!(e instanceof AppError) || e.code !== "PASS_NOT_FOUND") throw e;
    }
  }
  const { getPassByPublicId } = await import("./pass-service.js");
  return getPassByPublicId(ctx, idOrPublicId);
}

/**
 * D-027 account resolution for the Take path (preview + executions).
 *
 * Wallets are execution devices, not owned. Both identifiers name a row;
 * neither requires a session nor checks user_id (which is informational
 * only: who first linked the wallet). An existing row is never reassigned.
 * The wallet signature on the relayed payload is the authentication.
 */
async function resolveExecutionAccount(
  ctx: AppContext,
  input: { accountId?: string; accountAddress?: string },
): Promise<{
  id: string;
  accountAddress: string;
  agentAddress: string | null;
  venue: string | null;
}> {
  if (input.accountId) {
    return resolveExecutionAccountById(ctx, input.accountId);
  }
  const row = await resolveTradingAccountByAddress(ctx, input.accountAddress ?? "");
  return {
    id: row.id,
    accountAddress: row.accountAddress,
    agentAddress: row.agentAddress,
    venue: row.venue,
  };
}

async function resolveExecutionAccountById(
  ctx: AppContext,
  accountId: string,
): Promise<{
  id: string;
  accountAddress: string;
  agentAddress: string | null;
  venue: string | null;
}> {
  const rows = await ctx.db
    .select({
      id: tradingAccounts.id,
      accountAddress: tradingAccounts.accountAddress,
      agentAddress: tradingAccounts.agentAddress,
      venue: tradingAccounts.venue,
    })
    .from(tradingAccounts)
    .where(eq(tradingAccounts.id, accountId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AppError("FORBIDDEN", "Trading account not found.");
  // Per-venue approval: a stale-venue agent reads as not-approved.
  return {
    id: row.id,
    accountAddress: row.accountAddress,
    agentAddress: visibleAgentAddress(ctx, row),
    venue: row.venue,
  };
}

export async function buildExecutionPreview(
  ctx: AppContext,
  passId: string,
  takerId: string | null,
  input: ExecutionPreviewRequest,
): Promise<ExecutionPreviewDto> {
  const pass = await resolvePassForExecution(ctx, passId);

  if (pass.status !== "active" && pass.status !== "entry_pending") {
    throw new AppError("PASS_NOT_ACTIVE", `This Pass is ${pass.status}.`);
  }
  if (takerId !== null && pass.traderId === takerId) {
    throw new AppError(
      "FORBIDDEN",
      "You cannot take your own Pass. Publish it and let another Trader take it.",
    );
  }

  const account = await resolveExecutionAccount(ctx, input);
  checkTakeRateLimit("preview", account.accountAddress);

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
    accountId: account.id,
    agentAddress: account.agentAddress,
    venue: account.venue,
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
export interface RelayedExecutionFee {
  notionalUsd: string;
  feeUsd: string;
  creatorShareUsd: string;
  protocolShareUsd: string;
  builderFeeBps: number;
  simulated: true;
}

export async function relayExecution(
  ctx: AppContext,
  passId: string,
  takerId: string | null,
  input: ExecutionRequest,
): Promise<{
  executionId: string;
  providerOrderId: string;
  status: string;
  simulated: boolean;
  /** Simulated fee breakdown. Null on live fills and idempotent replays. */
  fee: RelayedExecutionFee | null;
}> {
  // Step 5 is checked first as a cheap idempotency guard, then re-checked at
  // its documented position. This never changes observable behaviour: a
  // duplicate returns the original record instead of submitting a second order.
  const existing = await findByClientRequestId(ctx, input.clientRequestId);
  if (existing) {
    return {
      executionId: existing.id,
      providerOrderId: existing.providerOrderId ?? "",
      status: existing.providerStatus,
      simulated: (existing as { simulated?: boolean }).simulated ?? false,
      fee: null,
    };
  }

  // 1. resolve the Taker (D-027): a row id for `accountId`, or the
  // wallet address for `accountAddress`. No session is required and no
  // ownership is checked; the wallet signature on the relayed payload is
  // the authentication.
  // (Live verification stays where it is: Hyperliquid verifies the L1
  // signature on relay, exactly as before. The server holds no signing
  // secrets and recovers no signers.)
  // 2. verify the Pass exists and is active.
  const pass: PassRow = await resolvePassForExecution(ctx, passId);
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

  // 4. resolve the trading account: a row id, or the address-keyed row
  // (created user-less on first anonymous use) for `accountAddress`.
  // D-027: neither form checks ownership. An existing row is never reassigned.
  const account = await resolveExecutionAccount(ctx, input);
  checkTakeRateLimit("execution", account.accountAddress);

  // 5. verify the clientRequestId has not been seen before.
  const dup = await findByClientRequestId(ctx, input.clientRequestId);
  if (dup) {
    return {
      executionId: dup.id,
      providerOrderId: dup.providerOrderId ?? "",
      status: dup.providerStatus,
      simulated: (dup as { simulated?: boolean }).simulated ?? false,
      fee: null,
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
    const reason = err instanceof Error ? err.message : String(err);
    ctx.log.error("hyperliquid relay failed", {
      passId,
      takerId,
      reason,
    });
    // The relay client throws this distinct error when the exchange
    // answered without a parseable order id. Preserve it verbatim (with
    // the raw response it carries) instead of collapsing it into the
    // generic rejection below.
    if (/could not read the order id/i.test(reason)) {
      throw new AppError("ORDER_REJECTED", reason.slice(0, 600));
    }
    throw new AppError("ORDER_REJECTED", "The order was rejected by the exchange.");
  }

  /**
   * A relay can come back REJECTED without throwing — Hyperliquid itself
   * answers 200 with a rejection status for some order errors. Only the
   * `catch` above was handled, so a rejected order would have been inserted
   * as a real execution row with an empty provider_order_id. A Take must
   * never be recorded as filled when the venue refused it.
   *
   * Simulated relays (mock mode) return `mock_<uuid>` / `pending` /
   * `simulated: true` with no network call. They are synthetic success and
   * must be recorded with `simulated: true`, never confused with a live fill.
   */
  if (!relayed.providerOrderId || /reject|error|fail/i.test(relayed.status)) {
    ctx.log.warn("hyperliquid relay returned a rejection", {
      passId,
      takerId,
      status: relayed.status,
    });
    if (relayed.providerOrderId) {
      throw new AppError(
        "ORDER_REJECTED",
        `The order was rejected by the exchange (${relayed.status}).`,
      );
    }
    // No order id. Two different causes, two different messages — the old
    // code blamed the mode for both:
    // - the exchange answered but PASS could not read an id from its
    //   response (live parse gap; the raw response is attached);
    // - nothing answered at all (relay disabled/gated: a mode problem).
    const raw = relayed.rawStatus as { mock?: unknown } | null | undefined;
    const exchangeResponded = raw != null && raw.mock !== true;
    throw new AppError(
      "ORDER_REJECTED",
      exchangeResponded
        ? `The exchange accepted the order but PASS could not read the order id: ${JSON.stringify(raw).slice(0, 300)}`
        : "Order relay is disabled in this deployment.",
      exchangeResponded ? { rawStatus: raw } : {},
    );
  }

  const simulated =
    relayed.simulated === true || relayed.providerOrderId.startsWith("mock_");

  // 7. record the provider_order_id and the execution row.
  // positionSize is the base size the Taker signed: the entry leg of the
  // bracket action. Older mock fixtures carry a top-level `sz` instead,
  // which is honored as a fallback so their history keeps its meaning.
  const signedReq = input.signedPayload.exchangeRequest as {
    sz?: number | string;
    action?: { orders?: Array<{ s?: number | string }> };
  };
  const signedBaseSize = signedReq?.action?.orders?.[0]?.s ?? signedReq?.sz ?? "0";
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
      simulated,
      side: sideFor(pass.direction),
      positionSize: toDecimalStringSafe(signedBaseSize),
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

  /**
   * Simulated fee ledger: every mock execution accrues one hypothetical
   * builder-fee row (5 bps on sizeUsd x leverage, split 50/50
   * creator/protocol). `positionSize`/`leverage` ride the request for fee
   * math only — execution itself came from the signed payload above. Live
   * executions never reach this branch: no real fees are charged by PASS.
   */
  let fee: RelayedExecutionFee | null = null;
  if (simulated) {
    const sizeUsd = Number(input.positionSize ?? NaN);
    const lev = Number(input.leverage ?? snapshot.leverage ?? NaN);
    const notional =
      Number.isFinite(sizeUsd) && sizeUsd > 0 && Number.isFinite(lev) && lev > 0
        ? sizeUsd * lev
        : 0;
    const feeUsd = computeFee(notional);
    const split = splitFee(feeUsd);
    const [feeRow] = await ctx.db
      .insert(feeLedger)
      .values({
        executionId: row.id,
        passId: pass.id,
        creatorUserId: pass.traderId,
        notionalUsd: String(notional),
        feeUsd: String(feeUsd),
        creatorShareUsd: String(split.creatorShareUsd),
        protocolShareUsd: String(split.protocolShareUsd),
        builderFeeBps: BUILDER_FEE_BPS,
        simulated: true,
      })
      .returning();
    if (!feeRow) throw new AppError("INTERNAL_ERROR", "Fee ledger insert returned no row.");
    fee = {
      notionalUsd: feeRow.notionalUsd,
      feeUsd: feeRow.feeUsd,
      creatorShareUsd: feeRow.creatorShareUsd,
      protocolShareUsd: feeRow.protocolShareUsd,
      builderFeeBps: feeRow.builderFeeBps,
      simulated: true,
    };
  }

  // 8. reconcile status via the Info API. Simulated rows skip the live
  // lookup: a `mock_` id is not a real oid, and mock mode must never make
  // a network call to Hyperliquid.
  if (!simulated) {
    await reconcileExecution(ctx, row.id, relayed.providerOrderId);
  }

  const fresh = await ctx.db
    .select()
    .from(executions)
    .where(eq(executions.id, row.id))
    .limit(1);

  return {
    executionId: row.id,
    providerOrderId: relayed.providerOrderId,
    status: fresh[0]?.providerStatus ?? relayed.status,
    simulated,
    fee,
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

/**
 * D-027 wallet executions: every execution taken with this wallet, no
 * session required. Reading executions for a wallet the caller did not
 * link is allowed — listing is a query concern, not a permission.
 * Unknown addresses list as empty, never 404.
 */
export async function listExecutionsByAddress(
  ctx: AppContext,
  accountAddress: string,
  limit: number,
) {
  const addr = accountAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    throw new AppError("INVALID_REQUEST", "That is not a valid EVM address.");
  }
  const accounts = await ctx.db
    .select({ id: tradingAccounts.id })
    .from(tradingAccounts)
    .where(
      and(
        eq(tradingAccounts.provider, "hyperliquid"),
        eq(tradingAccounts.accountAddress, addr),
      ),
    );
  if (accounts.length === 0) return [];
  const ids = accounts.map((a) => a.id);
  return ctx.db
    .select()
    .from(executions)
    .where(inArray(executions.accountId, ids))
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