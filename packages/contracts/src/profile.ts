import { z } from "zod";
import { IsoDateTime, PublicId, Slug, Uuid } from "./common.js";
import { PassPerformance, ReputationContext } from "./pass.js";

export const CreateProfileRequest = z
  .object({
    slug: Slug,
    displayName: z.string().min(1).max(80),
    bio: z.string().max(500).nullable().optional(),
    handle: z.string().max(40).nullable().optional(),
  })
  .strict();
export type CreateProfileRequest = z.infer<typeof CreateProfileRequest>;

export const UpdateProfileRequest = z
  .object({
    displayName: z.string().min(1).max(80).optional(),
    bio: z.string().max(500).nullable().optional(),
    handle: z.string().max(40).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
  })
  .strict();
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const ConnectionChip = z.object({
  provider: z.enum(["x", "hyperliquid", "ethos"]),
  connected: z.boolean(),
  label: z.string(),
  /** True when this is a display-only link with no OAuth tokens held. */
  displayOnly: z.boolean().default(false),
});
export type ConnectionChip = z.infer<typeof ConnectionChip>;

export const PublicProfileDto = z.object({
  slug: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  xHandle: z.string().nullable(),
  hyperliquidAccountAddress: z.string().nullable(),
  connections: z.array(ConnectionChip),
  /** PASS-owned performance only. Never combined with reputation. */
  performance: PassPerformance.nullable(),
  publishedPassCount: z.number().int().nonnegative(),
  completedPassCount: z.number().int().nonnegative(),
  activePassCount: z.number().int().nonnegative(),
  /** External reputation context. Rendered separately from performance. */
  reputation: ReputationContext.nullable(),
  createdAt: IsoDateTime,
});
export type PublicProfileDto = z.infer<typeof PublicProfileDto>;

export const SessionUserDto = z.object({
  userId: Uuid,
  profileId: Uuid.nullable(),
  profileSlug: z.string().nullable(),
  displayName: z.string().nullable(),
  connections: z.array(ConnectionChip),
});
export type SessionUserDto = z.infer<typeof SessionUserDto>;

export const ShareRequest = z
  .object({
    passId: PublicId,
    mode: z.enum(["copy", "post"]),
  })
  .strict();
export type ShareRequest = z.infer<typeof ShareRequest>;

export const ShareResponseDto = z.object({
  shareUrl: z.string(),
  shareText: z.string(),
  /** Present when a native X post was created. Never required for sharing. */
  xPostId: z.string().nullable(),
  xPostUrl: z.string().nullable(),
  /** True when only copy-to-clipboard is available. */
  copyOnly: z.boolean(),
});
export type ShareResponseDto = z.infer<typeof ShareResponseDto>;

export const TradingAccountDto = z.object({
  id: Uuid,
  provider: z.literal("hyperliquid"),
  accountAddress: z.string(),
  agentAddress: z.string().nullable(),
  isPrimary: z.boolean(),
});
export type TradingAccountDto = z.infer<typeof TradingAccountDto>;

/** Resolution outcome for an address the user typed. Never holds a key. */
export const AgentApprovalDto = z.object({
  accountAddress: z.string(),
  agentAddress: z.string(),
  approvedAt: IsoDateTime,
});
export type AgentApprovalDto = z.infer<typeof AgentApprovalDto>;