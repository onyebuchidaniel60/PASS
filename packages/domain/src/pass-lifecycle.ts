import type { PassStatus } from "@pass/contracts";

/**
 * docs/PRODUCT_PRD.md §10 state machine.
 *
 * ACTIVE and ENTRY_PENDING are represented separately; the displayed state
 * remains unambiguous. A terminal state never returns to active
 * (docs/DATA_MODEL.md §3.8).
 */
const TRANSITIONS: Record<PassStatus, readonly PassStatus[]> = {
  draft: ["active", "invalidated"],
  active: ["entry_pending", "expired", "cancelled", "invalidated"],
  entry_pending: ["open", "expired", "cancelled", "invalidated"],
  open: ["tp_hit", "sl_hit", "manually_closed", "expired", "invalidated"],
  tp_hit: [],
  sl_hit: [],
  manually_closed: [],
  expired: [],
  cancelled: [],
  invalidated: [],
};

export function canTransition(from: PassStatus, to: PassStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PassStatus, to: PassStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal Pass transition: ${from} -> ${to}`);
  }
}

export function allowedTransitions(from: PassStatus): readonly PassStatus[] {
  return TRANSITIONS[from];
}

/**
 * True when a Taker may still create an execution for this Pass.
 * docs/PRODUCT_PRD.md §14 requires the Pass to exist and be active.
 */
export function acceptsExecution(status: PassStatus): boolean {
  return status === "active" || status === "entry_pending";
}

/**
 * docs/PRODUCT_PRD.md §14 / docs/UX_SPEC.md §9 — a stale Pass must never be
 * silently executed. The reviewed version must equal the current published
 * version, unless a specific prior version was explicitly allowed.
 */
export function isStaleVersion(
  reviewedVersion: number,
  currentVersion: number,
  allowedPriorVersions: readonly number[] = [],
): boolean {
  if (reviewedVersion === currentVersion) return false;
  return !allowedPriorVersions.includes(reviewedVersion);
}

export const PASS_EVENT_FOR_STATUS: Partial<
  Record<PassStatus, "published" | "cancelled" | "expired" | "invalidated" | "entry_pending" | "opened" | "tp_hit" | "sl_hit" | "manually_closed">
> = {
  active: "published",
  cancelled: "cancelled",
  expired: "expired",
  invalidated: "invalidated",
  entry_pending: "entry_pending",
  open: "opened",
  tp_hit: "tp_hit",
  sl_hit: "sl_hit",
  manually_closed: "manually_closed",
};