/**
 * Canonical error codes.
 *
 * Source of truth: docs/API_CONTRACTS.md §14 (per docs/DECISIONS.md D-018.8).
 * Do not add a code here that is not listed in §14. Add it to §14 first.
 */
export const ERROR_CODES = [
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "PROFILE_NOT_FOUND",
  "IDENTITY_NOT_CONNECTED",
  "PASS_NOT_FOUND",
  "PASS_NOT_ACTIVE",
  "PASS_EXPIRED",
  "PASS_CANCELLED",
  "PASS_INVALIDATED",
  "PASS_VERSION_STALE",
  "INVALID_ASSET",
  "INVALID_DIRECTION",
  "INVALID_PRICE",
  "INVALID_POSITION_SIZE",
  "INVALID_LEVERAGE",
  "INSUFFICIENT_MARGIN",
  "SLIPPAGE_EXCEEDED",
  "SIGNATURE_REJECTED",
  "ORDER_REJECTED",
  "ORDER_PENDING",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_RATE_LIMITED",
  "DUPLICATE_REQUEST",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const ERROR_CODE_SET = new Set<string>(ERROR_CODES);

export function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODE_SET.has(value);
}

export const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "Authentication required.",
  FORBIDDEN: "You do not have access to this resource.",
  PROFILE_NOT_FOUND: "Profile not found.",
  IDENTITY_NOT_CONNECTED: "Identity is not connected.",
  PASS_NOT_FOUND: "Pass not found.",
  PASS_NOT_ACTIVE: "This Pass is no longer active.",
  PASS_EXPIRED: "This Pass has expired.",
  PASS_CANCELLED: "This Pass was cancelled.",
  PASS_INVALIDATED: "This Pass was invalidated.",
  PASS_VERSION_STALE: "This Pass changed. Review the latest Pass before executing.",
  INVALID_ASSET: "That asset is not supported.",
  INVALID_DIRECTION: "Direction must be long or short.",
  INVALID_PRICE: "Price is not valid.",
  INVALID_POSITION_SIZE: "Position size is not valid.",
  INVALID_LEVERAGE: "Leverage is not valid.",
  INSUFFICIENT_MARGIN: "Insufficient margin for this order.",
  SLIPPAGE_EXCEEDED: "Slippage tolerance exceeded.",
  SIGNATURE_REJECTED: "The provider rejected the request signature.",
  ORDER_REJECTED: "The order was rejected.",
  ORDER_PENDING: "The order is pending.",
  PROVIDER_UNAVAILABLE: "The upstream provider is unavailable.",
  PROVIDER_RATE_LIMITED: "The upstream provider rate limited the request.",
  DUPLICATE_REQUEST: "This request was already submitted.",
  INTERNAL_ERROR: "Something went wrong.",
};

/** HTTP status for each canonical code. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  PROFILE_NOT_FOUND: 404,
  IDENTITY_NOT_CONNECTED: 409,
  PASS_NOT_FOUND: 404,
  PASS_NOT_ACTIVE: 409,
  PASS_EXPIRED: 409,
  PASS_CANCELLED: 409,
  PASS_INVALIDATED: 409,
  PASS_VERSION_STALE: 409,
  INVALID_ASSET: 400,
  INVALID_DIRECTION: 400,
  INVALID_PRICE: 400,
  INVALID_POSITION_SIZE: 400,
  INVALID_LEVERAGE: 400,
  INSUFFICIENT_MARGIN: 422,
  SLIPPAGE_EXCEEDED: 422,
  SIGNATURE_REJECTED: 400,
  ORDER_REJECTED: 422,
  ORDER_PENDING: 202,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_RATE_LIMITED: 429,
  DUPLICATE_REQUEST: 409,
  INTERNAL_ERROR: 500,
};