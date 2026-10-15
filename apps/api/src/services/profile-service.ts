import { and, desc, eq } from "drizzle-orm";
import type { AppContext } from "../context.js";
import { AppError } from "../errors.js";
import {
  ethosProfiles,
  identities,
  passes,
  profiles,
  tradingAccounts,
  xConnections,
} from "@pass/db";
import { isValidProfileSlug } from "@pass/domain";
import { decryptSecret, encryptSecret } from "../crypto.js";
import type { CreateProfileRequest, UpdateProfileRequest } from "@pass/contracts";
import { passPerformance } from "./execution-service.js";

/**
 * docs/PRODUCT_PRD.md §11 minimum public profile. Reputation and trading
 * performance are returned as separate structures and are never merged into
 * one score or label (D-007, D-014).
 */

export const ETHOS_DISCLAIMER =
  "Ethos credibility is community sentiment based on public interactions. It is not an absolute measure of credibility or trustworthiness, and it changes as new data arrives.";

export async function createProfile(
  ctx: AppContext,
  userId: string,
  input: CreateProfileRequest,
): Promise<{ id: string; slug: string; displayName: string }> {
  if (!isValidProfileSlug(input.slug)) {
    throw new AppError(
      "FORBIDDEN",
      "Slug must be 3-32 characters, lowercase letters, numbers, or underscores.",
    );
  }

  const existing = await ctx.db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.slug, input.slug))
    .limit(1);
  if (existing.length > 0) {
    throw new AppError("FORBIDDEN", "That handle is already taken.");
  }

  const mine = await ctx.db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (mine.length > 0) {
    throw new AppError("FORBIDDEN", "You already have a PASS profile.");
  }

  const inserted = await ctx.db
    .insert(profiles)
    .values({
      userId,
      slug: input.slug,
      name: input.displayName,
      bio: input.bio ?? null,
      handle: input.handle ?? null,
    })
    .returning();

  const row = inserted[0];
  if (!row) throw new AppError("INTERNAL_ERROR");
  return { id: row.id, slug: row.slug, displayName: row.name };
}

export async function updateProfile(
  ctx: AppContext,
  userId: string,
  input: UpdateProfileRequest,
): Promise<void> {
  await ctx.db
    .update(profiles)
    .set({
      ...(input.displayName !== undefined ? { name: input.displayName } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.handle !== undefined ? { handle: input.handle } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.tourCompletedAt !== undefined
        ? {
            tourCompletedAt:
              input.tourCompletedAt === null ? null : new Date(input.tourCompletedAt),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId));
}

export async function getProfileBySlug(ctx: AppContext, slug: string) {
  const rows = await ctx.db.select().from(profiles).where(eq(profiles.slug, slug)).limit(1);
  const row = rows[0];
  if (!row) throw new AppError("PROFILE_NOT_FOUND");
  return row;
}

export async function getProfileByUserId(ctx: AppContext, userId: string) {
  const rows = await ctx.db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getXConnection(ctx: AppContext, userId: string) {
  const rows = await ctx.db
    .select()
    .from(xConnections)
    .where(eq(xConnections.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getXIdentity(ctx: AppContext, userId: string) {
  const rows = await ctx.db
    .select()
    .from(identities)
    .where(and(eq(identities.userId, userId), eq(identities.provider, "x")))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Single definition of a LIVE X connection, shared by `/me` and the public
 * profile (see the `/me` handler comment for the full statement): a held
 * `x_connections` row whose tokens are not expired. The `identities` row
 * alone never counts — it survives soft disconnects by design (D-018.6).
 */
export function isXConnectionLive(xConn: { tokenExpiresAt: Date | null } | null | undefined): boolean {
  if (!xConn) return false;
  return xConn.tokenExpiresAt == null || xConn.tokenExpiresAt.getTime() >= Date.now();
}

/**
 * Resolves an external identity back to its owning PASS user
 * (`docs/DATA_MODEL.md` §2, `UNIQUE(provider, provider_subject_id)`).
 *
 * The X callback uses this on the session-less sign-in path: an X account
 * that already belongs to a PASS user must sign into THAT user, never mint
 * a second user whose `x_connections` insert then collides on the unique
 * `x_user_id` index.
 */
export async function getIdentityByProviderSubject(
  ctx: AppContext,
  provider: "x" | "ethos",
  subject: string,
) {
  const rows = await ctx.db
    .select()
    .from(identities)
    .where(
      and(eq(identities.provider, provider), eq(identities.providerSubjectId, subject)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getEthosProfile(ctx: AppContext, userId: string) {
  const rows = await ctx.db
    .select()
    .from(ethosProfiles)
    .where(eq(ethosProfiles.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * The user's linked wallets. Returns only the ACTIVE row(s) — unlinked
 * (is_active = false) rows are internal history and never surface here.
 * /me, the Take preview, and account-state all read through this, so an
 * unlinked wallet is simply gone from every consumer.
 */
export async function getTradingAccounts(ctx: AppContext, userId: string) {
  return ctx.db
    .select()
    .from(tradingAccounts)
    .where(
      and(eq(tradingAccounts.userId, userId), eq(tradingAccounts.isActive, true)),
    )
    .orderBy(desc(tradingAccounts.createdAt));
}

export async function upsertXIdentity(
  ctx: AppContext,
  userId: string,
  data: {
    xUserId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  },
): Promise<void> {
  await ctx.db
    .insert(identities)
    .values({
      userId,
      provider: "x",
      providerSubjectId: data.xUserId,
      username: data.handle,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    })
    .onConflictDoUpdate({
      target: [identities.provider, identities.providerSubjectId],
      set: {
        username: data.handle,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date(),
      },
    });
}

/**
 * Stores X OAuth tokens encrypted at rest. A user may hold an identities row
 * for X with no tokens here (display-only linking) (D-018.6).
 */
export async function upsertXConnection(
  ctx: AppContext,
  userId: string,
  data: {
    xUserId: string;
    xHandle: string;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: string[] | null;
  },
): Promise<void> {
  await ctx.db
    .insert(xConnections)
    .values({
      userId,
      xUserId: data.xUserId,
      xHandle: data.xHandle,
      accessTokenEncrypted: data.accessToken ? encryptSecret(data.accessToken) : null,
      refreshTokenEncrypted: data.refreshToken ? encryptSecret(data.refreshToken) : null,
      tokenExpiresAt: data.expiresAt,
      scopes: data.scopes,
    })
    .onConflictDoUpdate({
      target: xConnections.userId,
      set: {
        xUserId: data.xUserId,
        xHandle: data.xHandle,
        accessTokenEncrypted: data.accessToken ? encryptSecret(data.accessToken) : null,
        refreshTokenEncrypted: data.refreshToken ? encryptSecret(data.refreshToken) : null,
        tokenExpiresAt: data.expiresAt,
        scopes: data.scopes,
        updatedAt: new Date(),
      },
    });
}

/** Decrypts a stored token for outbound use. Never logged, never returned. */
export async function readXAccessToken(ctx: AppContext, userId: string): Promise<string | null> {
  const conn = await getXConnection(ctx, userId);
  if (!conn?.accessTokenEncrypted) return null;
  try {
    return decryptSecret(conn.accessTokenEncrypted);
  } catch {
    return null;
  }
}

export async function linkTradingAccount(
  ctx: AppContext,
  userId: string,
  accountAddress: string,
  opts: { agentAddress?: string | null; isPrimary?: boolean } = {},
): Promise<{ id: string; accountAddress: string }> {
  const addr = accountAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    throw new AppError("FORBIDDEN", "That is not a valid EVM address.");
  }

  const existing = await ctx.db
    .select({ id: tradingAccounts.id, userId: tradingAccounts.userId })
    .from(tradingAccounts)
    .where(
      and(
        eq(tradingAccounts.provider, "hyperliquid"),
        eq(tradingAccounts.accountAddress, addr),
      ),
    )
    .limit(1);
  const clash = existing[0];
  if (clash) {
    // D-027: wallets are execution devices, not owned. Any session may
    // connect any wallet, so an existing row — another user's, or an
    // anonymous (D-026) row — is never a conflict and its recorded
    // first-linker user_id is never reassigned. Adopt the row for use and
    // keep only the caller's own per-user hygiene below.
    await deactivateOtherWallets(ctx, userId, clash.id);
    if (clash.userId === userId) {
      // Own row, possibly inactive from an earlier unlink: reactivate it.
      // Re-linking is idempotent.
      await ctx.db
        .update(tradingAccounts)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(tradingAccounts.id, clash.id));
    }
    return { id: clash.id, accountAddress: addr };
  }

  /**
   * One ACTIVE wallet per user: linking a new address retires the previous
   * active rows (is_active = false) instead of deleting them, so execution
   * history keeps its FK target (D-008). Unlink is never blocked.
   */
  await deactivateOtherWallets(ctx, userId, null);

  const inserted = await ctx.db
    .insert(tradingAccounts)
    .values({
      userId,
      provider: "hyperliquid",
      accountAddress: addr,
      agentAddress: opts.agentAddress ?? null,
      isPrimary: opts.isPrimary ?? true,
      isActive: true,
    })
    .onConflictDoNothing({
      target: [tradingAccounts.provider, tradingAccounts.accountAddress],
    })
    .returning();

  const row = inserted[0] ?? (
    await ctx.db
      .select({ id: tradingAccounts.id, accountAddress: tradingAccounts.accountAddress })
      .from(tradingAccounts)
      .where(
        and(
          eq(tradingAccounts.provider, "hyperliquid"),
          eq(tradingAccounts.accountAddress, addr),
        ),
      )
      .limit(1)
  )[0];
  if (!row) throw new AppError("INTERNAL_ERROR");
  return { id: row.id, accountAddress: row.accountAddress };
}

/** Retire the caller's active wallets except `keepId` (null retires all). */
async function deactivateOtherWallets(
  ctx: AppContext,
  userId: string,
  keepId: string | null,
): Promise<void> {
  const mine = await getTradingAccounts(ctx, userId);
  for (const old of mine) {
    if (keepId !== null && old.id === keepId) continue;
    await ctx.db
      .update(tradingAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(tradingAccounts.id, old.id));
  }
}

export type Venue = "mainnet" | "testnet" | "mock";

/**
 * The venue approvals are recorded against right now. Mock writes are
 * never a real venue: an approval the mock relay "accepted" was sent
 * nowhere, so it must never present as valid on a live venue later.
 */
export function currentVenue(ctx: AppContext): Venue {
  if (ctx.adapters.modes.hyperliquidExecution !== "live") return "mock";
  return /testnet/i.test(ctx.env.HYPERLIQUID_EXCHANGE_URL ?? "") ? "testnet" : "mainnet";
}

/**
 * Per-venue approval gate. A stored agentAddress presents only when its
 * venue matches the current one; otherwise it reads as not-approved and
 * the client re-prompts approveAgent instead of signing against a void
 * approval ("User or API Wallet … does not exist"). The row itself is
 * untouched — flipping venues back restores the earlier approval.
 */
export function visibleAgentAddress(
  ctx: AppContext,
  row: { agentAddress: string | null; venue?: string | null },
): string | null {
  if (!row.agentAddress) return null;
  if ((row.venue ?? "mock") !== currentVenue(ctx)) return null;
  return row.agentAddress;
}

export async function recordAgentApproval(
  ctx: AppContext,
  userId: string,
  accountAddress: string,
  agentAddress: string,
): Promise<void> {
  await ctx.db
    .update(tradingAccounts)
    .set({
      agentAddress: agentAddress.toLowerCase(),
      agentApprovedAt: new Date(),
      venue: currentVenue(ctx),
    })
    .where(
      and(
        eq(tradingAccounts.userId, userId),
        eq(tradingAccounts.accountAddress, accountAddress.toLowerCase()),
      ),
    );
}

/**
 * D-026: resolve a trading account by wallet address alone, creating it with
 * `user_id = null` on first anonymous use. An existing row is NEVER
 * reassigned: whatever `user_id` it carries (null or another user) is left
 * exactly as-is and the row is returned as the execution target.
 */
export async function resolveTradingAccountByAddress(
  ctx: AppContext,
  accountAddress: string,
): Promise<{
  id: string;
  accountAddress: string;
  agentAddress: string | null;
  venue: string | null;
  userId: string | null;
}> {
  const addr = accountAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) {
    throw new AppError("INVALID_REQUEST", "That is not a valid EVM address.");
  }
  const found = await ctx.db
    .select({
      id: tradingAccounts.id,
      accountAddress: tradingAccounts.accountAddress,
      agentAddress: tradingAccounts.agentAddress,
      venue: tradingAccounts.venue,
      userId: tradingAccounts.userId,
    })
    .from(tradingAccounts)
    .where(
      and(
        eq(tradingAccounts.provider, "hyperliquid"),
        eq(tradingAccounts.accountAddress, addr),
      ),
    )
    .limit(1);
  if (found[0]) {
    const row = found[0];
    return { ...row, agentAddress: visibleAgentAddress(ctx, row) };
  }
  const inserted = await ctx.db
    .insert(tradingAccounts)
    .values({
      userId: null,
      provider: "hyperliquid",
      accountAddress: addr,
      isPrimary: false,
    })
    .onConflictDoNothing({
      target: [tradingAccounts.provider, tradingAccounts.accountAddress],
    })
    .returning();
  const row = inserted[0];
  if (row) {
    return {
      id: row.id,
      accountAddress: row.accountAddress,
      agentAddress: row.agentAddress,
      venue: row.venue,
      userId: row.userId,
    };
  }
  // Lost a creation race with a concurrent first take: re-read the winner.
  const retry = await ctx.db
    .select({
      id: tradingAccounts.id,
      accountAddress: tradingAccounts.accountAddress,
      agentAddress: tradingAccounts.agentAddress,
      venue: tradingAccounts.venue,
      userId: tradingAccounts.userId,
    })
    .from(tradingAccounts)
    .where(
      and(
        eq(tradingAccounts.provider, "hyperliquid"),
        eq(tradingAccounts.accountAddress, addr),
      ),
    )
    .limit(1);
  const winner = retry[0];
  if (!winner) throw new AppError("INTERNAL_ERROR", "Trading account resolve failed.");
  return { ...winner, agentAddress: visibleAgentAddress(ctx, winner) };
}

/** D-026: record approval on a row by id (anonymous rows have no user scope). */
export async function recordAgentApprovalById(
  ctx: AppContext,
  accountId: string,
  agentAddress: string,
): Promise<void> {
  await ctx.db
    .update(tradingAccounts)
    .set({
      agentAddress: agentAddress.toLowerCase(),
      agentApprovedAt: new Date(),
      venue: currentVenue(ctx),
    })
    .where(eq(tradingAccounts.id, accountId));
}

/**
 * Resolves Ethos reputation for the user's own linked identity and caches it.
 * D-018.7: refresh operates only on the caller's own identity.
 */
export async function refreshEthosReputation(
  ctx: AppContext,
  userId: string,
): Promise<{ providerProfileId: string | null; syncedAt: string }> {
  const identity = await getXIdentity(ctx, userId);
  if (!identity) {
    throw new AppError("IDENTITY_NOT_CONNECTED", "Link an X identity first.");
  }

  const ref = identity.username ?? identity.providerSubjectId;
  const rep = await ctx.adapters.ethos.getReputation(ref);

  await ctx.db
    .insert(ethosProfiles)
    .values({
      userId,
      providerProfileId: rep?.providerProfileId ?? null,
      credibilityScore: rep?.credibilityScore === null || rep?.credibilityScore === undefined
        ? null
        : String(rep.credibilityScore),
      reviewsCount: rep?.reviewsCount ?? null,
      vouchesCount: rep?.vouchesCount ?? null,
      humanVerified: rep?.humanVerified ?? null,
      sourceUrl: rep?.sourceUrl ?? null,
      syncedAt: new Date(),
      rawSummary: rep ? (JSON.parse(JSON.stringify(rep)) as Record<string, unknown>) : null,
    })
    .onConflictDoUpdate({
      target: ethosProfiles.userId,
      set: {
        providerProfileId: rep?.providerProfileId ?? null,
        credibilityScore:
          rep?.credibilityScore === null || rep?.credibilityScore === undefined
            ? null
            : String(rep.credibilityScore),
        reviewsCount: rep?.reviewsCount ?? null,
        vouchesCount: rep?.vouchesCount ?? null,
        humanVerified: rep?.humanVerified ?? null,
        sourceUrl: rep?.sourceUrl ?? null,
        syncedAt: new Date(),
      },
    });

  return {
    providerProfileId: rep?.providerProfileId ?? null,
    syncedAt: new Date().toISOString(),
  };
}

export async function buildPublicProfile(ctx: AppContext, slug: string) {
  const profile = await getProfileBySlug(ctx, slug);
  const [xIdentity, xConn, ethos, accounts] = await Promise.all([
    getXIdentity(ctx, profile.userId),
    getXConnection(ctx, profile.userId),
    getEthosProfile(ctx, profile.userId),
    getTradingAccounts(ctx, profile.userId),
  ]);

  const owned = await ctx.db
    .select({
      id: passes.id,
      status: passes.status,
      asset: passes.asset,
      direction: passes.direction,
      entryPrice: passes.entryPrice,
      stopLoss: passes.stopLoss,
      takeProfit: passes.takeProfit,
      leverage: passes.leverage,
      publicId: passes.publicId,
      version: passes.version,
      entryType: passes.entryType,
      thesis: passes.thesis,
      publishedAt: passes.publishedAt,
      expiresAt: passes.expiresAt,
      createdAt: passes.createdAt,
      updatedAt: passes.updatedAt,
    })
    .from(passes)
    .where(eq(passes.traderId, profile.userId));

  const published = owned.filter((p) => p.publishedAt !== null);
  const completed = owned.filter((p) =>
    ["tp_hit", "sl_hit", "manually_closed"].includes(p.status),
  );
  const active = owned.filter((p) => ["active", "entry_pending"].includes(p.status));

  const primaryAccount = accounts.find((a) => a.isPrimary) ?? accounts[0] ?? null;

  // Same single definition as `/me`: liveness, never row existence.
  // D-023: no hyperliquid entry here either. The wallet is execution-only;
  // the linked row is still returned as `accountAddress` below for the
  // author's own Take flow, but it is never a connection state.
  const xLive = isXConnectionLive(xConn);
  const connections = [
    {
      provider: "x" as const,
      connected: xLive,
      label: xLive && xConn
        ? `X connected · @${xConn.xHandle}`
        : xIdentity
          ? `X linked · @${xIdentity.username} (display only)`
          : "X not connected",
      displayOnly: Boolean(xIdentity && !xLive),
    },
    {
      provider: "ethos" as const,
      connected: Boolean(ethos?.providerProfileId),
      label: ethos?.providerProfileId
        ? "Ethos reputation resolved"
        : "Ethos reputation not resolved",
      displayOnly: true,
    },
  ];

  // PASS performance: aggregate of this Trader's own Pass outcomes only.
  const perPass = [];
  for (const p of owned) {
    if (p.publishedAt === null) continue;
    perPass.push(await passPerformance(ctx, p.id));
  }
  const totals = perPass.reduce(
    (acc, cur) => ({
      takersCount: acc.takersCount + cur.takersCount,
      completedCount: acc.completedCount + cur.completedCount,
      tpHitCount: acc.tpHitCount + cur.tpHitCount,
      slHitCount: acc.slHitCount + cur.slHitCount,
      manuallyClosedCount: acc.manuallyClosedCount + cur.manuallyClosedCount,
    }),
    { takersCount: 0, completedCount: 0, tpHitCount: 0, slHitCount: 0, manuallyClosedCount: 0 },
  );

  const performance = {
    passId: profile.userId,
    takersCount: totals.takersCount,
    completedCount: totals.completedCount,
    tpHitCount: totals.tpHitCount,
    slHitCount: totals.slHitCount,
    manuallyClosedCount: totals.manuallyClosedCount,
    successRatePct:
      totals.completedCount === 0
        ? null
        : Math.round((totals.tpHitCount / totals.completedCount) * 10000) / 100,
    updatedAt: new Date().toISOString(),
  };

  const reputation = ethos
    ? {
        source: "ethos" as const,
        providerProfileId: ethos.providerProfileId,
        credibilityScore:
          ethos.credibilityScore === null ? null : Number(ethos.credibilityScore),
        reviewsCount: ethos.reviewsCount,
        vouchesCount: ethos.vouchesCount,
        humanVerified: ethos.humanVerified,
        sourceUrl: ethos.sourceUrl,
        syncedAt: ethos.syncedAt ? ethos.syncedAt.toISOString() : null,
        disclaimer: ETHOS_DISCLAIMER,
      }
    : null;

  return {
    profile,
    connections,
    performance,
    reputation,
    counts: {
      published: published.length,
      completed: completed.length,
      active: active.length,
    },
    activePasses: active,
    xHandle: xConn?.xHandle ?? xIdentity?.username ?? null,
    accountAddress: primaryAccount?.accountAddress ?? null,
  };
}