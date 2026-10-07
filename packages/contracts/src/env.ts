import { z } from "zod";
import { type RunMode } from "./common.js";

/**
 * Environment contract for the API and worker.
 *
 * Mode flags select mock vs live with no code change and no rebuild.
 * Default is mock. A missing credential falls back to mock in non-production
 * with one clear startup warning. In production a missing required credential
 * for a mode set to live must fail loudly rather than silently degrade.
 */

const modeFlag = (name: string) =>
  z
    .enum(["mock", "live"])
    .optional()
    .transform((v) => (v ?? "mock") as RunMode)
    .describe(`${name}_MODE`);

export const ApiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DATABASE_URL: z.string().optional(),
  /** Embedded Postgres for local dev/test when DATABASE_URL is absent. */
  DATABASE_PGLITE_PATH: z.string().optional(),

  APP_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16).optional(),
  ENCRYPTION_KEY: z.string().min(16).optional(),

  /**
   * Gates BOTH Hyperliquid reads and Hyperliquid writes. Kept as the single
   * switch for a fully live venue.
   *
   * WARNING: `HYPERLIQUID_MODE=live` also arms `relaySignedAction`, which
   * submits a real signed order to Hyperliquid mainnet. For read-only live
   * market data use `HYPERLIQUID_READS_MODE` instead — see below and D-021.
   */
  HYPERLIQUID_MODE: modeFlag("HYPERLIQUID"),
  /**
   * Read-only Hyperliquid Info API: mids, L2 books, account state, fills.
   *
   * Split out from `HYPERLIQUID_MODE` because a single flag cannot express
   * "live prices, no execution", and expressing that state by accident means
   * real orders. Public API, no credentials (D-018.9).
   */
  HYPERLIQUID_READS_MODE: modeFlag("HYPERLIQUID_READS"),
  HYPERLIQUID_INFO_URL: z.string().url().optional(),
  HYPERLIQUID_EXCHANGE_URL: z.string().url().optional(),

  ETHOS_MODE: modeFlag("ETHOS"),
  ETHOS_API_BASE_URL: z.string().url().optional(),

  X_MODE: modeFlag("X"),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_REDIRECT_URI: z.string().optional(),

  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),

  /**
   * Runs the worker's scheduled jobs inside the API process.
   * MVP hosting model per docs/DECISIONS.md D-020. Defaults to false so tests
   * and local development never start background jobs implicitly.
   */
  ENABLE_JOBS: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),

  /**
   * Seeds a demo Trader profile and Pass so the deployed mock-mode API can be
   * demonstrated end to end. Defaults to enabled whenever any provider is
   * running in mock mode; set to "never" to disable explicitly.
   */
  SEED_DEMO_DATA: z.enum(["auto", "always", "never"]).default("auto"),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export const WebEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().default("http://localhost:4000"),
  NEXT_PUBLIC_ENV: z
    .enum(["development", "preview", "production"])
    .default("development"),
});
export type WebEnv = z.infer<typeof WebEnvSchema>;

export function corsOrigins(env: ApiEnv): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isProduction(env: ApiEnv): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Resolves the effective mode for a provider.
 *
 * In production, requesting `live` without credentials is a hard failure:
 * mock mode must never be silently promoted to production.
 */
export function resolveMode(
  env: ApiEnv,
  provider: "hyperliquid" | "hyperliquid_reads" | "ethos" | "x",
  requiredCreds: string[],
): { mode: RunMode; warning?: string } {
  const requested = env[`${provider.toUpperCase()}_MODE` as
    | "HYPERLIQUID_MODE"
    | "HYPERLIQUID_READS_MODE"
    | "ETHOS_MODE"
    | "X_MODE"];
  const missing = requiredCreds.filter((c) => !env[c as keyof ApiEnv]);

  if (requested === "live" && missing.length > 0) {
    if (isProduction(env)) {
      throw new Error(
        `[${provider.toUpperCase()}] MODE=live but required credentials are missing: ${missing.join(", ")}. ` +
          `Refusing to start: mock mode must not be promoted to production.`,
      );
    }
    return {
      mode: "mock",
      warning:
        `[${provider.toUpperCase()}] MODE=live but credentials are missing (${missing.join(", ")}). Falling back to mock.`,
    };
  }

  if (requested === "live") return { mode: "live" };

  return {
    mode: "mock",
    warning:
      `[${provider.toUpperCase()}] MODE=mock. Provider responses are simulated fixtures, not live data.`,
  };
}

export const HYPERLIQUID_REQUIRED_CREDS = [
  "HYPERLIQUID_INFO_URL",
  "HYPERLIQUID_EXCHANGE_URL",
] as const;
/**
 * Live reads need only the Info URL. The Exchange URL is deliberately NOT
 * required here: requiring it would make "live reads" impossible to express
 * without also pointing the adapter at a write endpoint.
 */
export const HYPERLIQUID_READS_REQUIRED_CREDS = ["HYPERLIQUID_INFO_URL"] as const;
export const ETHOS_REQUIRED_CREDS = ["ETHOS_API_BASE_URL"] as const;
export const X_REQUIRED_CREDS = [
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  "X_REDIRECT_URI",
] as const;