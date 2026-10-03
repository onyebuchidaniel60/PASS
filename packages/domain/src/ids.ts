import { randomBytes, randomUUID } from "node:crypto";

/** URL-safe public identifier. Never used for authorization. */
export function newPublicId(len = 10): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export function newId(): string {
  return randomUUID();
}

/** Client-supplied idempotency key. */
export function newClientRequestId(): string {
  return `req_${randomBytes(12).toString("hex")}`;
}

/**
 * docs/DATA_MODEL.md: passes.slug is unique per (trader_id, slug).
 * Derived from the trader handle and the trade itself so the
 * human-readable URL is meaningful.
 */
export function buildPassSlug(input: {
  traderSlug: string;
  asset: string;
  direction: "long" | "short";
}): string {
  const assetPart = input.asset
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const dirPart = input.direction === "long" ? "long" : "short";
  return `${input.traderSlug}-${assetPart}-${dirPart}`.slice(0, 96);
}

const SLUG_RE = /^[a-z0-9_]{3,32}$/;

export function isValidProfileSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** Decimals stay strings end to end. Never parse to number for arithmetic. */
export function toDecimalString(n: number | string): string {
  if (typeof n === "string") return n;
  if (!Number.isFinite(n)) return "0";
  return String(Math.round((n + Number.EPSILON) * 100) / 100);
}

export function truncateAddress(
  address: string,
  lead = 4,
  tail = 4,
): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}