import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { CreateApiKeyRequest, SignedPayload, Uuid } from "@pass/contracts";
import type { AppContext } from "../context.js";
import { requireUser } from "../plugins/session.js";
import { requireAgentKey } from "../plugins/agent-auth.js";
import {
  createAgentApiKey,
  listAgentApiKeys,
  revokeAgentApiKey,
} from "../services/api-key-service.js";
import { AppError } from "../errors.js";
import { listPublicPasses, passOutcome } from "../services/pass-service.js";
import {
  relayExecution,
  resolvePassForExecution,
} from "../services/execution-service.js";

/**
 * Agent Execution API (NEAR Hackathon AGT track).
 *
 * Agents discover live Passes and relay a pre-signed Hyperliquid order. PASS
 * never holds an agent key: the signature in `signedPayload` is the authority,
 * exactly as on the human Take path. The execution routes are session-free but
 * require an Agent API key (`Authorization: Bearer pass_agt_...`), so a bot can
 * run headless without a browser cookie. The signed action cannot withdraw,
 * transfer, or change account settings.
 */

const ExecuteBody = z
  .object({
    passId: z.string().min(1),
    agentWalletAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "agentWalletAddress must be a 0x EVM address"),
    signedPayload: SignedPayload,
    /**
     * Optional idempotency key. When omitted the API mints one per request,
     * so a retried POST should carry the same `clientRequestId` to avoid a
     * duplicate order.
     */
    clientRequestId: z.string().min(8).max(128).optional(),
    /** Optional reviewed version; defaults to the Pass's current version. */
    passVersion: z.number().int().positive().optional(),
  })
  .strict();

function agentPass(row: Awaited<ReturnType<typeof listPublicPasses>>[number]) {
  return {
    passId: row.publicId,
    version: row.version,
    asset: row.asset,
    marketClass: row.marketClass ?? "perp",
    outcome: passOutcome(row),
    direction: row.direction,
    status: row.status,
    entryType: row.entryType,
    entryPrice: row.entryPrice,
    stopLoss: row.stopLoss,
    takeProfit: row.takeProfit,
    leverage: row.leverage,
    thesis: row.thesis,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    canonicalPath: `/p/${row.publicId}`,
    executeEndpoint: "/api/v1/agent/execute",
  };
}

export async function registerAgentRoutes(app: FastifyInstance, ctx: AppContext) {
  // Key management is session-owned. The keys themselves are used only as
  // Bearer credentials on the two execution-facing routes below.
  app.post("/api/v1/agent/keys", async (req, reply) => {
    const userId = await requireUser(req);
    const input = CreateApiKeyRequest.parse(req.body);
    const created = await createAgentApiKey(ctx, userId, input.name);
    return reply.status(201).send(created);
  });

  app.get("/api/v1/agent/keys", async (req) => {
    const userId = await requireUser(req);
    return { keys: await listAgentApiKeys(ctx, userId) };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/agent/keys/:id",
    async (req) => {
      const userId = await requireUser(req);
      const id = Uuid.parse(req.params.id);
      const revoked = await revokeAgentApiKey(ctx, userId, id);
      if (!revoked) {
        throw new AppError(
          "FORBIDDEN",
          "API key not found or already revoked.",
        );
      }
      return { ok: true, id };
    },
  );

  const agentAuth = async (req: Parameters<typeof requireAgentKey>[1]) => {
    await requireAgentKey(ctx, req);
  };

  app.get<{ Querystring: { limit?: string } }>(
    "/api/v1/agent/passes",
    { preHandler: agentAuth },
    async (req) => {
      const limit = Math.min(Math.max(Number(req.query.limit ?? "20") || 20, 1), 100);
      const rows = await listPublicPasses(ctx, { status: "active", limit });
      return {
        passes: rows.map(agentPass),
        count: rows.length,
        generatedAt: new Date().toISOString(),
        mode: ctx.adapters.hyperliquid.mode,
        docs: {
          execute: "POST /api/v1/agent/execute",
          body: ["passId", "agentWalletAddress", "signedPayload"],
        },
      };
    },
  );

  /**
   * Relays a pre-signed order through the same validation and recording path
   * as the human Take flow. `agentWalletAddress` is the Hyperliquid account
   * the order acts for; the signed action itself names the signer.
   */
  app.post(
    "/api/v1/agent/execute",
    { preHandler: agentAuth },
    async (req, reply) => {
      const body = ExecuteBody.parse(req.body);
      const pass = await resolvePassForExecution(ctx, body.passId);
      const passVersion = body.passVersion ?? pass.version;
      const clientRequestId =
        body.clientRequestId ?? `agent_${randomUUID()}`;

      const result = await relayExecution(ctx, pass.id, null, {
        passVersion,
        accountAddress: body.agentWalletAddress,
        clientRequestId,
        signedPayload: body.signedPayload,
      });

      return reply.status(201).send({
        passId: pass.publicId,
        passVersion,
        agentWalletAddress: body.agentWalletAddress.toLowerCase(),
        clientRequestId,
        executionId: result.executionId,
        providerOrderId: result.providerOrderId,
        status: result.status,
        simulated: result.simulated,
        mode: ctx.adapters.hyperliquid.mode,
      });
    },
  );
}
