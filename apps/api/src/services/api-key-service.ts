import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";

import type {
  ApiKeyCreatedDto,
  ApiKeySummaryDto,
} from "@pass/contracts";
import { apiKeys } from "@pass/db";
import type { AppContext } from "../context.js";

/**
 * Agent API keys.
 *
 * A key is 32 random bytes rendered as lowercase hex and prefixed with
 * `pass_agt_`. Only its SHA-256 hash is stored. The key itself has 256 bits of
 * entropy, so a fast hash is sufficient here: there is no low-entropy password
 * to brute-force, and hashing lets the middleware use an indexed lookup rather
 * than scanning every row.
 */

const KEY_PREFIX = "pass_agt_";
const KEY_HEX_BYTES = 32;
const KEY_HEX_LENGTH = KEY_HEX_BYTES * 2;
const KEY_PATTERN = /^pass_agt_[0-9a-f]{64}$/;

export function generateAgentApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(KEY_HEX_BYTES).toString("hex")}`;
}

export function hashAgentApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function isAgentApiKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/** The non-secret identifier shown in Settings, e.g. `pass_agt_a1b2c3d4`. */
export function agentApiKeyPrefix(key: string): string {
  return `${KEY_PREFIX}${key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8)}`;
}

function toSummary(row: {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}): ApiKeySummaryDto {
  return {
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  };
}

export async function createAgentApiKey(
  ctx: AppContext,
  userId: string,
  name: string,
): Promise<ApiKeyCreatedDto> {
  const key = generateAgentApiKey();
  const inserted = await ctx.db
    .insert(apiKeys)
    .values({
      userId,
      name,
      keyHash: hashAgentApiKey(key),
      keyPrefix: agentApiKeyPrefix(key),
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new Error("API key insert returned no row.");
  return { ...toSummary(row), key };
}

export async function listAgentApiKeys(
  ctx: AppContext,
  userId: string,
): Promise<ApiKeySummaryDto[]> {
  const rows = await ctx.db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map(toSummary);
}

/**
 * Soft-revoke an owned key. Returns false when the key does not exist, is
 * already revoked, or belongs to someone else. The caller maps all three to
 * the same refusal so a probe cannot discover another user's key ids.
 */
export async function revokeAgentApiKey(
  ctx: AppContext,
  userId: string,
  keyId: string,
): Promise<boolean> {
  const rows = await ctx.db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) return false;

  await ctx.db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId));
  return true;
}

export { KEY_PREFIX, KEY_HEX_LENGTH };
