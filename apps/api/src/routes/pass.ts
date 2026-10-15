import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import {
  CreatePassRequest,
  ExecutionPreviewRequest,
  UpdatePassRequest,
  PaginationQuery,
} from "@pass/contracts";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { requireUser } from "../plugins/session.js";
import { feeLedger } from "@pass/db";
import {
  cancelPass,
  createPass,
  getPassById,
  listOwnedPasses,
  listPassEvents,
  publishPass,
  updatePass,
} from "../services/pass-service.js";
import {
  buildExecutionPreview,
  getExecution,
  listExecutionsByAddress,
  listMyExecutions,
  listPassExecutions,
  passPerformance,
  reconcileExecution,
  relayExecution,
} from "../services/execution-service.js";
import { ExecutionRequest } from "@pass/contracts";
import { AppError } from "../errors.js";

export async function registerPassRoutes(app: FastifyInstance, ctx: AppContext) {
  // Authenticated mutations use the internal passes.id UUID (D-018.4).
  app.post("/api/v1/passes", async (req) => {
    const userId = await requireUser(req);
    // A Trader is an identified user (PRODUCT_PRD.md §4). A bare session —
    // e.g. surviving an X disconnect, which clears identity rows but never
    // the session — must not author a Pass with no author attribution.
    const { getXIdentity } = await import("../services/profile-service.js");
    const identity = await getXIdentity(ctx, userId);
    if (!identity) {
      throw new AppError("IDENTITY_NOT_CONNECTED", "Connect an X identity before authoring a Pass.");
    }
    const input = CreatePassRequest.parse(req.body);
    const row = await createPass(ctx, userId, input);
    return {
      id: row.id,
      publicId: row.publicId,
      version: row.version,
      status: row.status,
      slug: row.slug,
    };
  });

  app.patch<{ Params: { id: string } }>("/api/v1/passes/:id", async (req) => {
    const userId = await requireUser(req);
    const input = UpdatePassRequest.parse(req.body);
    const row = await updatePass(ctx, req.params.id, userId, input);
    return { id: row.id, version: row.version, status: row.status };
  });

  app.post<{ Params: { id: string } }>("/api/v1/passes/:id/publish", async (req) => {
    const userId = await requireUser(req);
    const row = await publishPass(ctx, req.params.id, userId);
    return {
      id: row.id,
      publicId: row.publicId,
      status: row.status,
      version: row.version,
      canonicalPath: `/p/${row.publicId}`,
    };
  });

  app.post<{ Params: { id: string } }>("/api/v1/passes/:id/cancel", async (req) => {
    const userId = await requireUser(req);
    const row = await cancelPass(ctx, req.params.id, userId);
    return { id: row.id, status: row.status };
  });

  app.get<{ Params: { id: string } }>("/api/v1/me/passes/:id", async (req) => {
    const userId = await requireUser(req);
    const row = await getPassById(ctx, req.params.id);
    if (row.traderId !== userId) throw new AppError("FORBIDDEN");
    const events = await listPassEvents(ctx, row.id);
    const performance = await passPerformance(ctx, row.id);
    return {
      id: row.id,
      publicId: row.publicId,
      version: row.version,
      status: row.status,
      asset: row.asset,
      direction: row.direction,
      entryType: row.entryType,
      entryPrice: row.entryPrice,
      stopLoss: row.stopLoss,
      takeProfit: row.takeProfit,
      leverage: row.leverage,
      thesis: row.thesis,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      performance,
      events: events.map((e) => ({
        id: e.id,
        passVersion: e.passVersion,
        eventType: e.eventType,
        eventAt: e.eventAt.toISOString(),
        metadata: e.metadata,
      })),
    };
  });

  app.get("/api/v1/me/passes", async (req) => {
    const userId = await requireUser(req);
    const q = PaginationQuery.parse(req.query ?? {});
    const rows = await listOwnedPasses(ctx, userId, q.limit);
    // Simulated fees earned per Pass: summed creator shares from fee_ledger
    // for this author. Passes with no takes map to null and render $0.00.
    const feeSums = await ctx.db
      .select({
        passId: feeLedger.passId,
        total: sql<string>`coalesce(sum(${feeLedger.creatorShareUsd}), 0)`,
      })
      .from(feeLedger)
      .where(eq(feeLedger.creatorUserId, userId))
      .groupBy(feeLedger.passId);
    const byPass = new Map(feeSums.map((r) => [r.passId, r.total]));
    return {
      passes: rows.map((r) => ({
        id: r.id,
        publicId: r.publicId,
        version: r.version,
        status: r.status,
        asset: r.asset,
        direction: r.direction,
        entryType: r.entryType,
        entryPrice: r.entryPrice,
        stopLoss: r.stopLoss,
        takeProfit: r.takeProfit,
        leverage: r.leverage,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        canonicalPath: `/p/${r.publicId}`,
        feesEarnedUsd: byPass.get(r.id) ?? null,
      })),
    };
  });

  app.get("/api/v1/me/dashboard", async (req) => {
    const userId = await requireUser(req);
    const [owned, execs] = await Promise.all([
      listOwnedPasses(ctx, userId, 100),
      listMyExecutions(ctx, userId, 20),
    ]);
    const byStatus = (s: string) => owned.filter((p) => p.status === s).length;
    return {
      counts: {
        draft: byStatus("draft"),
        active: byStatus("active"),
        entry_pending: byStatus("entry_pending"),
        open: byStatus("open"),
        completed: owned.filter((p) =>
          ["tp_hit", "sl_hit", "manually_closed"].includes(p.status),
        ).length,
      },
      recentPasses: owned.slice(0, 10).map((r) => ({
        id: r.id,
        publicId: r.publicId,
        asset: r.asset,
        direction: r.direction,
        status: r.status,
      })),
      recentExecutions: execs.map((e) => ({
        id: e.id,
        asset: null,
        status: e.status,
        positionSize: e.positionSize,
        realizedPnl: e.realizedPnl,
        createdAt: e.createdAt.toISOString(),
      })),
      demoMode: ctx.demoMode,
    };
  });
}

export async function registerExecutionRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post<{ Params: { id: string } }>(
    "/api/v1/passes/:id/execution-preview",
    async (req) => {
      // D-026: session-optional. A signed-out Taker previews against the
      // address-keyed row; the wallet signature is the authentication.
      const userId = req.sessionUserId ?? null;
      const input = ExecutionPreviewRequest.parse(req.body);
      const preview = await buildExecutionPreview(ctx, req.params.id, userId, input);
      return preview;
    },
  );

  /**
   * docs/DECISIONS.md D-018.3 — the server-relay path. The client signs and
   * submits; the server validates, relays, records, and reconciles.
   * D-026: session-optional (see API_CONTRACTS.md §8).
   */
  app.post<{ Params: { id: string } }>("/api/v1/passes/:id/executions", async (req, reply) => {
    const userId = req.sessionUserId ?? null;
    const input = ExecutionRequest.parse(req.body);
    const result = await relayExecution(ctx, req.params.id, userId, input);
    // Flat simulated-fee fields (docs/API_CONTRACTS.md §8): present with the
    // fee_ledger values on mock executions, null on live fills and replays.
    return reply.status(201).send({
      executionId: result.executionId,
      providerOrderId: result.providerOrderId,
      status: result.status,
      simulated: result.simulated,
      notionalUsd: result.fee?.notionalUsd ?? null,
      feeUsd: result.fee?.feeUsd ?? null,
      creatorShareUsd: result.fee?.creatorShareUsd ?? null,
      protocolShareUsd: result.fee?.protocolShareUsd ?? null,
      builderFeeBps: result.fee?.builderFeeBps ?? null,
    });
  });

  app.get<{ Params: { id: string } }>("/api/v1/executions/:id", async (req) => {
    const userId = await requireUser(req);
    const row = await getExecution(ctx, req.params.id, userId);
    if (row.providerOrderId && !(row as { simulated?: boolean }).simulated) {
      await reconcileExecution(ctx, row.id, row.providerOrderId);
    }
    const fresh = await getExecution(ctx, req.params.id, userId);
    return {
      id: fresh.id,
      passId: fresh.passId,
      passVersion: fresh.passVersion,
      providerOrderId: fresh.providerOrderId,
      providerStatus: fresh.providerStatus,
      simulated: (fresh as { simulated?: boolean }).simulated ?? false,
      status: fresh.status,
      positionSize: fresh.positionSize,
      leverage: fresh.leverage,
      requestedEntry: fresh.requestedEntry,
      actualEntry: fresh.actualEntry,
      stopLoss: fresh.stopLoss,
      takeProfit: fresh.takeProfit,
      realizedPnl: fresh.realizedPnl,
      openedAt: fresh.openedAt ? fresh.openedAt.toISOString() : null,
      closedAt: fresh.closedAt ? fresh.closedAt.toISOString() : null,
      createdAt: fresh.createdAt.toISOString(),
    };
  });

  app.get("/api/v1/me/executions", async (req) => {
    const userId = await requireUser(req);
    const q = PaginationQuery.parse(req.query ?? {});
    const rows = await listMyExecutions(ctx, userId, q.limit);
    return {
      executions: rows.map((e) => ({
        id: e.id,
        passId: e.passId,
        passVersion: e.passVersion,
        providerOrderId: e.providerOrderId,
        providerStatus: e.providerStatus,
        simulated: (e as { simulated?: boolean }).simulated ?? false,
        status: e.status,
        positionSize: e.positionSize,
        realizedPnl: e.realizedPnl,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  /**
   * D-027 wallet executions: every execution taken with this wallet. No
   * session is required and any wallet may be queried — listing is a query
   * concern, not a permission. Same item shape as GET /me/executions so
   * clients can render both identically. Unknown addresses list as empty.
   */
  app.get("/api/v1/executions", async (req) => {
    const q = z
      .object({
        accountAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        limit: z.coerce.number().int().positive().max(100).optional(),
      })
      .parse(req.query ?? {});
    const rows = await listExecutionsByAddress(ctx, q.accountAddress, q.limit ?? 20);
    return {
      executions: rows.map((e) => ({
        id: e.id,
        passId: e.passId,
        passVersion: e.passVersion,
        providerOrderId: e.providerOrderId,
        providerStatus: e.providerStatus,
        simulated: (e as { simulated?: boolean }).simulated ?? false,
        status: e.status,
        positionSize: e.positionSize,
        realizedPnl: e.realizedPnl,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  app.post<{ Params: { publicId: string } }>(
    "/api/v1/passes/:publicId/refresh",
    async (req) => {
      // Refreshes provider order status for a Pass's executions. Reconciliation
      // writes execution state, so it is an authenticated mutation even though
      // the Pass itself is public. The scheduled job covers signed-out reads.
      await requireUser(req);
      const { getPassByPublicId } = await import("../services/pass-service.js");
      const pass = await getPassByPublicId(ctx, req.params.publicId);
      const rows = await listPassExecutions(ctx, pass.id);
      for (const r of rows) {
        if (r.providerOrderId) await reconcileExecution(ctx, r.id, r.providerOrderId);
      }
      return { refreshed: rows.length };
    },
  );

  app.post("/api/v1/validate/pass", async (req) => {
    // Live form validation for the Create Pass screen (docs/UX_SPEC.md §7).
    const body = z
      .object({
        asset: z.string().optional(),
        direction: z.enum(["long", "short"]).optional(),
        entryType: z.enum(["market", "limit"]).optional(),
        entryPrice: z.string().nullable().optional(),
        stopLoss: z.string().nullable().optional(),
        takeProfit: z.string().nullable().optional(),
        leverage: z.string().nullable().optional(),
        expiresAt: z.string().nullable().optional(),
      })
      .parse(req.body ?? {});

    const { validatePlan } = await import("@pass/domain");
    const failures = validatePlan({
      asset: body.asset ?? "",
      direction: body.direction ?? "long",
      entryType: body.entryType ?? "limit",
      entryPrice: body.entryPrice ?? null,
      stopLoss: body.stopLoss ?? null,
      takeProfit: body.takeProfit ?? null,
      leverage: body.leverage ?? null,
      expiresAt: body.expiresAt ?? null,
    });
    return { valid: failures.length === 0, failures };
  });
}