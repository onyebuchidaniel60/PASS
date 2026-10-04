import { eq } from "drizzle-orm";
import type { AppContext } from "./context.js";
import {
  ethosProfiles,
  identities,
  passes,
  profiles,
  tradingAccounts,
  users,
} from "@pass/db";
import { createPass, getPassById, publishPass } from "./services/pass-service.js";

/**
 * Demo seed data.
 *
 * The deployed API runs with every provider in mock mode, which means there
 * are no real Traders to resolve. This seeds one clearly-labelled demo
 * Trader so the extension overlay and the public Pass page can be shown
 * end to end without an operator having to create accounts by hand first.
 *
 * It is DEMO DATA. It is not a claim about a real trader, and every surface
 * that renders it already labels mock mode in the UI.
 *
 * Idempotent: safe to run on every boot. Nothing is inserted if the profile
 * already exists.
 */

export interface DemoTraderSpec {
  handle: string;
  slug: string;
  displayName: string;
  bio: string;
  accountAddress: string;
  ethos: {
    credibilityScore: number;
    reviewsCount: number;
    vouchesCount: number;
    humanVerified: boolean;
  };
  pass: {
    asset: string;
    direction: "long" | "short";
    entryType: "limit" | "market";
    entryPrice: string | null;
    stopLoss: string | null;
    takeProfit: string | null;
    leverage: string | null;
    thesis: string;
    expiresInHours: number;
  };
}

export const DEMO_TRADER: DemoTraderSpec = {
  handle: "turnttfup99",
  slug: "turnttfup99",
  displayName: "Demo Trader",
  bio: "Demo profile. BTC / ETH perpetual trader (mock data).",
  accountAddress: "0x00000000000000000000000000000000000d3a0",
  ethos: {
    credibilityScore: 1742,
    reviewsCount: 38,
    vouchesCount: 21,
    humanVerified: true,
  },
  pass: {
    asset: "BTC",
    direction: "long",
    entryType: "limit",
    entryPrice: "113400",
    stopLoss: "111900",
    takeProfit: "116000",
    leverage: "5",
    thesis:
      "BTC reclaiming the 113.4k range top with increasing volume. Invalidation below the 111.9k swing low.",
    expiresInHours: 72,
  },
};

export interface SeedResult {
  seeded: boolean;
  reason?: string;
  slug?: string;
  publicId?: string;
}

/**
 * Seeds the demo trader when appropriate.
 *
 * Runs when SEED_DEMO_DATA is "always", or when it is "auto" (the default)
 * and at least one provider is in mock mode. Never runs when every provider
 * is live, so a real deployment is not polluted with fabricated profiles.
 */
export async function seedDemoData(ctx: AppContext): Promise<SeedResult> {
  const setting = ctx.env.SEED_DEMO_DATA;
  const anyMock =
    ctx.adapters.modes.hyperliquid === "mock" ||
    ctx.adapters.modes.ethos === "mock" ||
    ctx.adapters.modes.x === "mock";

  if (setting === "never") return { seeded: false, reason: "disabled" };
  if (setting === "auto" && !anyMock) {
    return { seeded: false, reason: "all providers live" };
  }

  try {
    return await seedTrader(ctx, DEMO_TRADER);
  } catch (err) {
    // Seeding must never stop the API from serving.
    ctx.log.warn("demo seed failed", {
      reason: err instanceof Error ? err.message : String(err),
    });
    return { seeded: false, reason: "error" };
  }
}

async function seedTrader(
  ctx: AppContext,
  spec: DemoTraderSpec,
): Promise<SeedResult> {
  const existing = await ctx.db
    .select({ id: profiles.id, userId: profiles.userId })
    .from(profiles)
    .where(eq(profiles.slug, spec.slug))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0]!;
    const pass = await ctx.db
      .select({ publicId: passes.publicId })
      .from(passes)
      .where(eq(passes.traderId, row.userId))
      .limit(1);
    return {
      seeded: false,
      reason: "already present",
      slug: spec.slug,
      publicId: pass[0]?.publicId,
    };
  }

  const insertedUser = await ctx.db.insert(users).values({}).returning();
  const user = insertedUser[0];
  if (!user) throw new Error("demo seed: could not create user");

  await ctx.db.insert(profiles).values({
    userId: user.id,
    slug: spec.slug,
    name: spec.displayName,
    bio: spec.bio,
    handle: spec.handle,
  });

  // X identity so the extension overlay recognises the handle. No OAuth token
  // is stored: this is a display-only link (D-018.6).
  await ctx.db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: `x_demo_${spec.handle.toLowerCase()}`,
    username: spec.handle,
    displayName: spec.displayName,
    avatarUrl: null,
  });

  await ctx.db.insert(tradingAccounts).values({
    userId: user.id,
    provider: "hyperliquid",
    accountAddress: spec.accountAddress,
    agentAddress: null,
    isPrimary: true,
  });

  // Ethos is external reputation context and is stored separately from any
  // trading performance (D-007, D-014).
  await ctx.db.insert(ethosProfiles).values({
    userId: user.id,
    providerProfileId: `ethos_demo_${spec.handle.toLowerCase()}`,
    credibilityScore: String(spec.ethos.credibilityScore),
    reviewsCount: spec.ethos.reviewsCount,
    vouchesCount: spec.ethos.vouchesCount,
    humanVerified: spec.ethos.humanVerified,
    sourceUrl: null,
    syncedAt: new Date(),
  });

  const expiresAt = new Date(Date.now() + spec.pass.expiresInHours * 3600 * 1000);

  const pass = await createPass(ctx, user.id, {
    asset: spec.pass.asset,
    direction: spec.pass.direction,
    entryType: spec.pass.entryType,
    entryPrice: spec.pass.entryPrice,
    stopLoss: spec.pass.stopLoss,
    takeProfit: spec.pass.takeProfit,
    leverage: spec.pass.leverage,
    thesis: spec.pass.thesis,
    expiresAt: expiresAt.toISOString(),
  });

  await publishPass(ctx, pass.id, user.id);
  const published = await getPassById(ctx, pass.id);

  ctx.log.info("demo trader seeded", {
    slug: spec.slug,
    handle: spec.handle,
    publicId: published.publicId,
  });

  return { seeded: true, slug: spec.slug, publicId: published.publicId };
}