import { z } from "zod";

/**
 * Financial values cross the API boundary as decimal strings so that no
 * binary floating-point ambiguity is introduced (docs/API_CONTRACTS.md §12,
 * docs/DATA_MODEL.md §4).
 */
export const DecimalString = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Must be a decimal string, e.g. \"113400.25\"");

export const PositiveDecimalString = DecimalString.refine(
  (v) => Number(v) > 0,
  "Must be greater than zero",
);

export const NonNegativeDecimalString = DecimalString.refine(
  (v) => Number(v) >= 0,
  "Must be zero or greater",
);

export const IsoDateTime = z.string().datetime({ offset: true });

export const Uuid = z.string().uuid();

/** Public, human-facing, URL-safe Pass identifier. */
export const PublicId = z
  .string()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9_-]+$/, "publicId must be URL-safe");

export const Slug = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_]+$/, "slug must be lowercase alphanumeric with underscores");

export const Cursor = z.string().min(1);

export const PaginationQuery = z.object({
  cursor: Cursor.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof PaginationQuery>;

export const PassDirection = z.enum(["long", "short"]);
export type PassDirection = z.infer<typeof PassDirection>;

export const PassEntryType = z.enum(["market", "limit"]);
export type PassEntryType = z.infer<typeof PassEntryType>;

/**
 * docs/PRODUCT_PRD.md §10. The displayed state must remain unambiguous;
 * ACTIVE and ENTRY_PENDING may be represented separately or combined, but
 * PASS keeps them distinct.
 */
export const PassStatus = z.enum([
  "draft",
  "active",
  "entry_pending",
  "open",
  "tp_hit",
  "sl_hit",
  "manually_closed",
  "expired",
  "cancelled",
  "invalidated",
]);
export type PassStatus = z.infer<typeof PassStatus>;

/** States from which a Taker may still create a new execution. */
export const TAKABLE_STATUSES: readonly PassStatus[] = [
  "active",
  "entry_pending",
] as const;

export function isTakable(status: PassStatus): boolean {
  return TAKABLE_STATUSES.includes(status);
}

/** Terminal states (docs/DATA_MODEL.md §3.8: never silently return to active). */
export const TERMINAL_STATUSES: readonly PassStatus[] = [
  "tp_hit",
  "sl_hit",
  "manually_closed",
  "expired",
  "cancelled",
  "invalidated",
] as const;

export function isTerminal(status: PassStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const PassEventType = z.enum([
  "created",
  "updated",
  "published",
  "cancelled",
  "expired",
  "invalidated",
  "entry_pending",
  "opened",
  "tp_hit",
  "sl_hit",
  "manually_closed",
  "execution_recorded",
]);
export type PassEventType = z.infer<typeof PassEventType>;

export const ProviderName = z.enum(["hyperliquid", "ethos", "x"]);
export type ProviderName = z.infer<typeof ProviderName>;

/** Provider adapter run mode. Selected by env var alone. */
export const RunMode = z.enum(["mock", "live"]);
export type RunMode = z.infer<typeof RunMode>;