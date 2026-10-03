import { z } from "zod";
import {
  DecimalString,
  IsoDateTime,
  PassDirection,
  PassEntryType,
  PassEventType,
  PassStatus,
  PublicId,
  Uuid,
} from "./common.js";

/**
 * The execution-relevant plan snapshot. This is the shape stored in
 * pass_versions.snapshot and is what an execution resolves against.
 */
export const TradePlanSnapshot = z.object({
  asset: z.string().min(1),
  dex: z.string().nullable(),
  direction: PassDirection,
  entryType: PassEntryType,
  entryPrice: DecimalString.nullable(),
  stopLoss: DecimalString.nullable(),
  takeProfit: DecimalString.nullable(),
  leverage: DecimalString.nullable(),
  expiresAt: IsoDateTime.nullable(),
});
export type TradePlanSnapshot = z.infer<typeof TradePlanSnapshot>;

export const CreatePassRequest = z
  .object({
    asset: z.string().min(1, "Asset is required"),
    direction: PassDirection,
    entryType: PassEntryType,
    entryPrice: DecimalString.nullable().optional(),
    stopLoss: DecimalString.nullable().optional(),
    takeProfit: DecimalString.nullable().optional(),
    leverage: DecimalString.nullable().optional(),
    thesis: z.string().min(1, "Thesis is required").max(4000),
    expiresAt: IsoDateTime.nullable().optional(),
  })
  .strict();
export type CreatePassRequest = z.infer<typeof CreatePassRequest>;

export const UpdatePassRequest = CreatePassRequest.partial().extend({
  version: z.number().int().positive(),
});
export type UpdatePassRequest = z.infer<typeof UpdatePassRequest>;

/**
 * Ethos reputation context. Read from the cached snapshot only.
 * Never merged with trading performance into a single score (D-007, D-018.6).
 */
export const ReputationContext = z.object({
  source: z.literal("ethos"),
  providerProfileId: z.string().nullable(),
  credibilityScore: z.number().nullable(),
  reviewsCount: z.number().int().nullable(),
  vouchesCount: z.number().int().nullable(),
  humanVerified: z.boolean().nullable(),
  sourceUrl: z.string().nullable(),
  syncedAt: IsoDateTime.nullable(),
  /**
   * Ethos states credibility is not an absolute measure of trustworthiness.
   * Surfaced so the UI can attribute the number rather than assert it.
   */
  disclaimer: z.string(),
});
export type ReputationContext = z.infer<typeof ReputationContext>;

export const TraderSummary = z.object({
  userId: Uuid,
  slug: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  xHandle: z.string().nullable(),
  hyperliquidAccountAddress: z.string().nullable(),
});
export type TraderSummary = z.infer<typeof TraderSummary>;

/**
 * PASS performance for a Pass. Strictly separate from any account-level
 * Hyperliquid figure (D-014, docs/PRODUCT_PRD.md §13).
 */
export const PassPerformance = z.object({
  passId: Uuid,
  takersCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  tpHitCount: z.number().int().nonnegative(),
  slHitCount: z.number().int().nonnegative(),
  manuallyClosedCount: z.number().int().nonnegative(),
  /** Percentage of completed executions that reached TP. Null when n/a. */
  successRatePct: z.number().nullable(),
  updatedAt: IsoDateTime,
});
export type PassPerformance = z.infer<typeof PassPerformance>;

/** Observed Hyperliquid account context, always labelled as account-level. */
export const AccountContext = z.object({
  accountAddress: z.string(),
  label: z.literal("Hyperliquid account context"),
  accountValue: DecimalString.nullable(),
  withdrawable: DecimalString.nullable(),
  observedAt: IsoDateTime,
});
export type AccountContext = z.infer<typeof AccountContext>;

export const MarketSnapshotDto = z.object({
  provider: z.literal("hyperliquid"),
  asset: z.string(),
  markPrice: DecimalString,
  midPrice: DecimalString.nullable(),
  observedAt: IsoDateTime,
});
export type MarketSnapshotDto = z.infer<typeof MarketSnapshotDto>;

export const PassSummaryDto = z.object({
  publicId: PublicId,
  slug: z.string(),
  version: z.number().int().positive(),
  traderId: Uuid,
  asset: z.string(),
  direction: PassDirection,
  status: PassStatus,
  entryType: PassEntryType,
  entryPrice: DecimalString.nullable(),
  stopLoss: DecimalString.nullable(),
  takeProfit: DecimalString.nullable(),
  leverage: DecimalString.nullable(),
  thesis: z.string(),
  publishedAt: IsoDateTime.nullable(),
  expiresAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type PassSummaryDto = z.infer<typeof PassSummaryDto>;

export const PublicPassDto = PassSummaryDto.extend({
  trader: TraderSummary,
  reputation: ReputationContext.nullable(),
  market: MarketSnapshotDto.nullable(),
  performance: PassPerformance.nullable(),
  /** Authoritative immutable path. */
  canonicalPath: z.string(),
});
export type PublicPassDto = z.infer<typeof PublicPassDto>;

export const PassEventDto = z.object({
  id: Uuid,
  passVersion: z.number().int().positive().nullable(),
  eventType: PassEventType,
  eventAt: IsoDateTime,
  metadata: z.record(z.unknown()).nullable(),
});
export type PassEventDto = z.infer<typeof PassEventDto>;

export const ExecutionPreviewRequest = z
  .object({
    passVersion: z.number().int().positive(),
    accountId: Uuid,
    positionSize: z.union([DecimalString, z.number().positive()]),
    leverage: z.union([DecimalString, z.number().positive()]).optional(),
    slippageToleranceBps: z.number().int().min(0).max(10_000).default(50),
  })
  .strict();
export type ExecutionPreviewRequest = z.infer<typeof ExecutionPreviewRequest>;

export const ExecutionWarning = z.object({
  code: z.string(),
  message: z.string(),
});
export type ExecutionWarning = z.infer<typeof ExecutionWarning>;

export const ExecutionPreviewDto = z.object({
  passVersion: z.number().int().positive(),
  passPublicId: PublicId,
  asset: z.string(),
  direction: PassDirection,
  entryType: PassEntryType,
  positionSize: DecimalString,
  leverage: DecimalString.nullable(),
  requestedEntry: DecimalString.nullable(),
  markPrice: DecimalString.nullable(),
  marketObservedAt: IsoDateTime.nullable(),
  stopLoss: DecimalString.nullable(),
  takeProfit: DecimalString.nullable(),
  slippageToleranceBps: z.number().int(),
  estimatedMargin: DecimalString.nullable(),
  availableMargin: DecimalString.nullable(),
  warnings: z.array(ExecutionWarning),
  requiresConfirmation: z.literal(true),
  observedAt: IsoDateTime,
});
export type ExecutionPreviewDto = z.infer<typeof ExecutionPreviewDto>;

/**
 * Signed Hyperliquid action as produced in the client's trusted context.
 * Never contains a private key (docs/DECISIONS.md D-018.3, D-018.9).
 */
export const SignedPayload = z.object({
  exchangeRequest: z.record(z.unknown()),
  signature: z.record(z.unknown()),
});
export type SignedPayload = z.infer<typeof SignedPayload>;

export const ExecutionRequest = z
  .object({
    passVersion: z.number().int().positive(),
    accountId: Uuid,
    clientRequestId: z.string().min(8).max(128),
    signedPayload: SignedPayload,
  })
  .strict();
export type ExecutionRequest = z.infer<typeof ExecutionRequest>;

/** docs/API_CONTRACTS.md §8 response shape. */
export const ExecutionResponseDto = z.object({
  executionId: Uuid,
  providerOrderId: z.string(),
  status: z.string(),
});
export type ExecutionResponseDto = z.infer<typeof ExecutionResponseDto>;

export const ExecutionRecordDto = z.object({
  id: Uuid,
  passId: Uuid,
  passPublicId: PublicId,
  passVersion: z.number().int().positive(),
  asset: z.string(),
  direction: PassDirection,
  positionSize: DecimalString,
  leverage: DecimalString.nullable(),
  requestedEntry: DecimalString.nullable(),
  actualEntry: DecimalString.nullable(),
  providerOrderId: z.string().nullable(),
  providerStatus: z.string(),
  status: PassStatus,
  openedAt: IsoDateTime.nullable(),
  closedAt: IsoDateTime.nullable(),
  realizedPnl: DecimalString.nullable(),
  createdAt: IsoDateTime,
});
export type ExecutionRecordDto = z.infer<typeof ExecutionRecordDto>;