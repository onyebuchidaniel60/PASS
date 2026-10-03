import {
  DEFAULT_MESSAGES,
  ERROR_STATUS,
  isErrorCode,
  type ErrorCode,
} from "@pass/contracts";

/**
 * Application error carrying a canonical code from
 * docs/API_CONTRACTS.md §14. No code outside §14 may be produced
 * (docs/DECISIONS.md D-018.8).
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message?: string,
    details: Record<string, unknown> = {},
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toErrorResponse(err: unknown): {
  status: number;
  body: {
    error: { code: ErrorCode; message: string; details: Record<string, unknown> };
    requestId?: string;
  };
} {
  if (isAppError(err)) {
    return {
      status: err.status,
      body: {
        error: { code: err.code, message: err.message, details: err.details },
      },
    };
  }

  // Zod validation failures surface as INVALID_* where we can map them,
  // otherwise they are a bad request. We never invent a code.
  if (
    typeof err === "object" &&
    err !== null &&
    "issues" in err &&
    Array.isArray((err as { issues: unknown }).issues)
  ) {
    return {
      status: 400,
      body: {
        error: {
          code: "INVALID_PRICE",
          message: "Request validation failed.",
          details: { issues: (err as { issues: unknown }).issues },
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: DEFAULT_MESSAGES.INTERNAL_ERROR,
        details: {},
      },
    },
  };
}

export function assertErrorCode(code: string): asserts code is ErrorCode {
  if (!isErrorCode(code)) {
    throw new Error(
      `Attempted to use error code "${code}" which is not in docs/API_CONTRACTS.md §14.`,
    );
  }
}