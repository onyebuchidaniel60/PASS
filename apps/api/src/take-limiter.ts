import { AppError } from "./errors.js";

/**
 * D-026: Take rate limiting is keyed by wallet address, not by session —
 * a signed-out Taker has no session to key on. Applied to the Take path
 * (execution preview + execution submission) after the trading account is
 * resolved, so the key is always the canonical lowercased address.
 *
 * In-memory sliding window. MVP scope per D-020 (single API process);
 * a multi-process deployment must move this to shared storage.
 */
const WINDOW_MS = 60_000;
const LIMITS = {
  preview: 120,
  execution: 60,
} as const;

const hits = new Map<string, number[]>();

export function checkTakeRateLimit(
  kind: keyof typeof LIMITS,
  accountAddress: string,
): void {
  const now = Date.now();
  const key = `${kind}:${accountAddress.toLowerCase()}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMITS[kind]) {
    throw new AppError(
      "PROVIDER_RATE_LIMITED",
      "Too many Take requests for this wallet. Try again shortly.",
    );
  }
  recent.push(now);
  hits.set(key, recent);
}

/** Test hook. Not used in production code. */
export function resetTakeRateLimits(): void {
  hits.clear();
}
