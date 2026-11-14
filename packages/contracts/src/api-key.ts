import { z } from "zod";

import { IsoDateTime, Uuid } from "./common.js";

/**
 * Agent API key management.
 *
 * The plaintext key appears ONLY in `ApiKeyCreatedDto`. Every read shape uses
 * `ApiKeySummaryDto`, which carries the non-secret prefix instead.
 */

export const ApiKeySummaryDto = z.object({
  id: Uuid,
  name: z.string(),
  prefix: z.string(),
  createdAt: IsoDateTime,
  lastUsedAt: IsoDateTime.nullable(),
});
export type ApiKeySummaryDto = z.infer<typeof ApiKeySummaryDto>;

export const ApiKeyListDto = z.object({
  keys: z.array(ApiKeySummaryDto),
});
export type ApiKeyListDto = z.infer<typeof ApiKeyListDto>;

export const CreateApiKeyRequest = z
  .object({
    name: z.string().trim().min(1, "Key name is required.").max(80),
  })
  .strict();
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequest>;

export const ApiKeyCreatedDto = ApiKeySummaryDto.extend({
  /**
   * The plaintext credential. Returned exactly once, at creation. It is never
   * accepted by any read route and never stored.
   */
  key: z.string().regex(/^pass_agt_[0-9a-f]{64}$/),
});
export type ApiKeyCreatedDto = z.infer<typeof ApiKeyCreatedDto>;

export const ApiKeyRevokedDto = z.object({
  ok: z.literal(true),
  id: Uuid,
});
export type ApiKeyRevokedDto = z.infer<typeof ApiKeyRevokedDto>;
