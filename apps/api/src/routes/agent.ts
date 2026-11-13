import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { SignedPayload } from "@pass/contracts";
import type { AppContext } from "../context.js";
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
 * exactly as on the human Take path. The endpoint is deliberately
 * session-free so a bot can run headless; it cannot withdraw, transfer, or
 * change account settings because the signed Hyperliquid action cannot.
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
  app.get<{ Querystring: { limit?: string } }>(
    "/api/v1/agent/passes",
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
  app.post("/api/v1/agent/execute", async (req, reply) => {
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
  });
}
