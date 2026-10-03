import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "./env.js";
import { AppError } from "./errors.js";

/**
 * Symmetric encryption for OAuth token material at rest
 * (docs/DATA_MODEL.md, docs/SECURITY_SPEC.md §8, §15).
 * Tokens are never logged and never returned by a public endpoint (D-018.6).
 */

function key(): Buffer {
  const raw = env().ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new AppError("INTERNAL_ERROR", "ENCRYPTION_KEY must be set (min 16 chars).");
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new AppError("INTERNAL_ERROR", "Malformed encrypted value.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Stable PKCE S256 challenge (docs/SECURITY_SPEC.md §8). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}