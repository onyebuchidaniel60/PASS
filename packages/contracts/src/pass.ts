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
import { DEFAULT_SLIPPAGE_TOLERANCE_BPS, MAX_LEVERAGE } from "./limits.js";

/**
 * Leverage at the API boundary: 1–MAX_LEVERAGE. The venue rejects anything
 * above the ceiling, so the schema refuses it before any state is written.
 */
const LeverageString = DecimalString.refine(
  (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= MAX_LEVERAGE;
  },
  { message: `Leverage must be between 1 and ${MAX_LEVERAGE}.` },
);

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
    leverage: LeverageString.nullable().optional(),
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
    /** Session-owned row (existing behaviour). Exactly one of the two. */
    accountId: Uuid.optional(),
    /** Wallet address for a signed-out Take (D-026). Exactly one of the two. */
    accountAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "accountAddress must be a 0x EVM address")
      .optional(),
    positionSize: z.union([DecimalString, z.number().positive()]),
    leverage: z.union([LeverageString, z.number().positive().max(MAX_LEVERAGE)]).optional(),
    slippageToleranceBps: z.number().int().min(0).max(10_000).default(DEFAULT_SLIPPAGE_TOLERANCE_BPS),
  })
  .strict()
  .refine((v) => (v.accountId ? !v.accountAddress : !!v.accountAddress), {
    message: "Exactly one of accountId, accountAddress is required.",
  });
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
  /** The resolved trading-account row (D-026: created user-less for anonymous Takes). */
  accountId: Uuid,
  /**
   * Venue-approved agent on the resolved row, if any. Lets a signed-out
   * Taker skip re-approval when it matches their stable client agent —
   * anonymous rows carry no other channel for this (D-026 + approval
   * skip). An address, never key material.
   */
  agentAddress: z.string().nullable(),
  /**
   * Venue the presented approval belongs to (mainnet/testnet/mock), null
   * when there is none. The client signs approveAgent with the matching
   * hyperliquidChain — "Testnet" on testnet — because Hyperliquid expects
   * the label to match the venue.
   */
  venue: z.string().nullable(),
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
    /** Session-owned row (existing behaviour). Exactly one of the two. */
    accountId: Uuid.optional(),
    /** Wallet address for a signed-out Take (D-026). Exactly one of the two. */
    accountAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "accountAddress must be a 0x EVM address")
      .optional(),
    clientRequestId: z.string().min(8).max(128),
    /**
     * Taker's chosen size in USDC, as shown on the Take screen. Optional and
     * fee-computation only: execution always comes from `signedPayload`, never
     * from these fields.
     */
    positionSize: z.union([DecimalString, z.number()]).optional(),
    /** Taker's chosen leverage. Optional; same fee-only role as positionSize. */
    leverage: z.union([DecimalString, z.number()]).optional(),
    signedPayload: SignedPayload,
  })
  .strict()
  .refine((v) => (v.accountId ? !v.accountAddress : !!v.accountAddress), {
    message: "Exactly one of accountId, accountAddress is required.",
  });
export type ExecutionRequest = z.infer<typeof ExecutionRequest>;

/** Simulated fee breakdown attached to a mock execution response. Null on live fills. */
export const ExecutionFeeDto = z.object({
  notionalUsd: DecimalString,
  feeUsd: DecimalString,
  creatorShareUsd: DecimalString,
  protocolShareUsd: DecimalString,
  builderFeeBps: z.number().int(),
  simulated: z.literal(true),
});
export type ExecutionFeeDto = z.infer<typeof ExecutionFeeDto>;

/** docs/API_CONTRACTS.md §8 response shape. */
export const ExecutionResponseDto = z.object({
  executionId: Uuid,
  providerOrderId: z.string(),
  status: z.string(),
  /**
   * True when the execution was simulated (HYPERLIQUID_MODE=mock). The client
   * must render a "SIMULATED" marker inline with the provider order id;
   * a simulated row is a demo, never a real trade.
   */
  simulated: z.boolean(),
  /**
   * Simulated fee breakdown for a mock execution (fee_ledger row). Null on
   * live fills and on idempotent replays: no real fees are ever charged.
   */
  notionalUsd: DecimalString.nullable(),
  feeUsd: DecimalString.nullable(),
  creatorShareUsd: DecimalString.nullable(),
  protocolShareUsd: DecimalString.nullable(),
  builderFeeBps: z.number().int().nullable(),
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
  /** True when the execution was simulated in mock mode. Never a real trade. */
  simulated: z.boolean(),
  openedAt: IsoDateTime.nullable(),
  closedAt: IsoDateTime.nullable(),
  realizedPnl: DecimalString.nullable(),
  createdAt: IsoDateTime,
});
export type ExecutionRecordDto = z.infer<typeof ExecutionRecordDto>;