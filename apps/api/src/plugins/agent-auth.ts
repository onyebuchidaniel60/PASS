import { and, eq, isNull } from "drizzle-orm";
import type { FastifyRequest } from "fastify";

import { apiKeys, users } from "@pass/db";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import {
  hashAgentApiKey,
  isAgentApiKey,
} from "../services/api-key-service.js";

declare module "fastify" {
  interface FastifyRequest {
    /** User that owns the presented Agent API key, set by requireAgentKey. */
    agentKeyUserId?: string | null;
    /** The key row id, useful for auditing without storing the secret. */
    agentKeyId?: string | null;
  }
}

/**
 * Bearer authentication for `/api/v1/agent/passes` and
 * `/api/v1/agent/execute`.
 *
 * The presented key is hashed and looked up by the unique hash index. Only an
 * unrevoked key owned by an active user is accepted. Every failure returns the
 * same 401 shape, so a caller cannot distinguish a malformed key from an
 * unknown or revoked one.
 */
export async function requireAgentKey(
  ctx: AppContext,
  req: FastifyRequest,
): Promise<string> {
  const header = req.headers.authorization;
  const match =
    typeof header === "string"
      ? /^Bearer\s+(.+)$/i.exec(header.trim())
      : null;
  const presented = match?.[1]?.trim() ?? "";

  if (!isAgentApiKey(presented)) {
    throw new AppError("AUTH_REQUIRED", "A valid Agent API key is required.");
  }

  const rows = await ctx.db
    .select({ id: apiKeys.id, userId: apiKeys.userId })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(
      and(
        eq(apiKeys.keyHash, hashAgentApiKey(presented)),
        isNull(apiKeys.revokedAt),
        eq(users.status, "active"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new AppError("AUTH_REQUIRED", "A valid Agent API key is required.");
  }

  await ctx.db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));

  req.agentKeyId = row.id;
  req.agentKeyUserId = row.userId;
  return row.userId;
}
