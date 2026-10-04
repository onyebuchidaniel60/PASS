import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import {
  getPassByPublicId,
  getPassById,
  listPassEvents,
  listPublicPasses,
} from "../services/pass-service.js";
import { passPerformance, listPassExecutions } from "../services/execution-service.js";
import { buildPublicProfile, getProfileBySlug } from "../services/profile-service.js";
import { AppError } from "../errors.js";
import { ETHOS_DISCLAIMER } from "../services/profile-service.js";

/** docs/UX_SPEC.md §5 information order, as data. */
function passToSummary(row: Record<string, unknown>) {
  return {
    publicId: row.publicId,
    slug: row.slug,
    version: row.version,
    asset: row.asset,
    direction: row.direction,
    status: row.status,
    entryType: row.entryType,
    entryPrice: row.entryPrice,
    stopLoss: row.stopLoss,
    takeProfit: row.takeProfit,
    leverage: row.leverage,
    thesis: row.thesis,
    publishedAt: row.publishedAt ? new Date(row.publishedAt as string).toISOString() : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt as string).toISOString() : null,
    createdAt: new Date(row.createdAt as string).toISOString(),
    updatedAt: new Date(row.updatedAt as string).toISOString(),
    canonicalPath: `/p/${String(row.publicId)}`,
  };
}

export async function registerPublicRoutes(app: FastifyInstance, ctx: AppContext) {
  // docs/API_CONTRACTS.md §3 — public reads use passes.public_id.
  app.get<{ Params: { publicId: string } }>("/api/v1/passes/:publicId", async (req) => {
    const row = await getPassByPublicId(ctx, req.params.publicId);
    const { buildPublicProfile } = await import("../services/profile-service.js");
    const profile = await buildPublicProfile(ctx, await slugForTrader(ctx, row.traderId));

    let market = null;
    try {
      market = await ctx.adapters.hyperliquid.getSnapshot(row.asset);
    } catch {
      market = null;
    }

    const performance = await passPerformance(ctx, row.id);

    return {
      ...passToSummary(row as unknown as Record<string, unknown>),
      trader: {
        userId: profile.profile.userId,
        slug: profile.profile.slug,
        handle: profile.profile.handle,
        displayName: profile.profile.name,
        bio: profile.profile.bio,
        avatarUrl: profile.profile.avatarUrl,
        xHandle: profile.xHandle,
        hyperliquidAccountAddress: profile.accountAddress,
      },
      reputation: profile.reputation,
      market,
      performance,
      demoMode: ctx.demoMode,
    };
  });

  // Convenience human-readable URL: /@{traderSlug}/{asset}-{direction}
  app.get<{ Params: { slug: string; tail: string } }>(
    "/api/v1/@/:slug/:tail",
    async (req) => {
      const profile = await getProfileBySlug(ctx, req.params.slug);
      const all = await listPublicPasses(ctx, { limit: 200, traderId: profile.userId });
      const wanted = req.params.tail.toLowerCase();
      const match = all.find((p) => {
        const asset = String(p.asset).toLowerCase();
        const dir = p.direction === "long" ? "long" : "short";
        return wanted === `${asset}-${dir}` || wanted === `${asset}${dir}`;
      });
      if (!match) throw new AppError("PASS_NOT_FOUND");
      return { publicId: match.publicId, canonicalPath: `/p/${match.publicId}` };
    },
  );

  app.get<{ Querystring: { limit?: string; status?: string } }>(
    "/api/v1/discover",
    async (req) => {
      const limit = Math.min(Number(req.query.limit ?? "30") || 30, 100);
      const rows = await listPublicPasses(ctx, {
        limit,
        status: req.query.status ?? null,
      });
      return {
        demoMode: ctx.demoMode,
        passes: rows.map((r) => passToSummary(r as unknown as Record<string, unknown>)),
      };
    },
  );

  app.get<{ Params: { slug: string } }>("/api/v1/profiles/:slug", async (req) => {
    const p = await buildPublicProfile(ctx, req.params.slug);
    return {
      slug: p.profile.slug,
      handle: p.profile.handle,
      displayName: p.profile.name,
      bio: p.profile.bio,
      avatarUrl: p.profile.avatarUrl,
      xHandle: p.xHandle,
      hyperliquidAccountAddress: p.accountAddress,
      connections: p.connections,
      performance: p.performance,
      publishedPassCount: p.counts.published,
      completedPassCount: p.counts.completed,
      activePassCount: p.counts.active,
      reputation: p.reputation,
      createdAt: p.profile.createdAt.toISOString(),
      demoMode: ctx.demoMode,
    };
  });

  app.get<{ Params: { slug: string } }>(
    "/api/v1/profiles/:slug/reputation",
    async (req) => {
      // Read-only public Ethos context from the cached snapshot (D-018.7).
      const p = await buildPublicProfile(ctx, req.params.slug);
      return p.reputation ?? {
        source: "ethos",
        providerProfileId: null,
        credibilityScore: null,
        reviewsCount: null,
        vouchesCount: null,
        humanVerified: null,
        sourceUrl: null,
        syncedAt: null,
        disclaimer: ETHOS_DISCLAIMER,
      };
    },
  );

  app.get<{ Params: { slug: string } }>("/api/v1/profiles/:slug/passes", async (req) => {
    const p = await buildPublicProfile(ctx, req.params.slug);
    const rows = await listPublicPasses(ctx, { limit: 100, traderId: p.profile.userId });
    return { passes: rows.map((r) => passToSummary(r as unknown as Record<string, unknown>)) };
  });

  app.get<{ Params: { publicId: string } }>(
    "/api/v1/passes/:publicId/events",
    async (req) => {
      const row = await getPassByPublicId(ctx, req.params.publicId);
      const events = await listPassEvents(ctx, row.id);
      return {
        events: events.map((e) => ({
          id: e.id,
          passVersion: e.passVersion,
          eventType: e.eventType,
          eventAt: e.eventAt.toISOString(),
          metadata: e.metadata,
        })),
      };
    },
  );

  app.get<{ Params: { publicId: string } }>(
    "/api/v1/passes/:publicId/executions",
    async (req) => {
      const row = await getPassByPublicId(ctx, req.params.publicId);
      const rows = await listPassExecutions(ctx, row.id);
      // Only PASS-owned, verified metrics are exposed on a public Pass.
      return {
        executions: rows.map((e) => ({
          id: e.id,
          passVersion: e.passVersion,
          positionSize: e.positionSize,
          leverage: e.leverage,
          side: e.side,
          status: e.status,
          openedAt: e.openedAt ? e.openedAt.toISOString() : null,
          closedAt: e.closedAt ? e.closedAt.toISOString() : null,
          realizedPnl: e.realizedPnl,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    },
  );

  app.get<{ Querystring: { handle?: string } }>("/api/v1/resolve/x", async (req) => {
    // Extension resolution endpoint. Display-only; returns no token material.
    const handle = req.query.handle;
    if (!handle) throw new AppError("IDENTITY_NOT_CONNECTED", "handle is required");
    const user = await ctx.adapters.x.resolveIdentity(handle);
    return user;
  });

  app.get<{ Querystring: { handle?: string } }>("/api/v1/extension/context", async (req) => {
    const handle = req.query.handle?.replace(/^@/, "");
    if (!handle) return { found: false, reason: "no_handle" };
    const { profiles } = await import("@pass/db");
    const { eq } = await import("drizzle-orm");
    const rows = await ctx.db
      .select()
      .from(profiles)
      .where(eq(profiles.slug, handle.toLowerCase()))
      .limit(1);
    const profile = rows[0];
    if (!profile) return { found: false, reason: "not_on_pass" };

    const p = await buildPublicProfile(ctx, profile.slug);
    const active = await listPublicPasses(ctx, { limit: 5, traderId: profile.userId });
    return {
      found: true,
      displayName: p.profile.name,
      xHandle: p.xHandle,
      activePassCount: p.counts.active,
      // Public Ethos context for the overlay card (docs/EXTENSION_SPEC.md §3).
      // credibilityScore is null until a trader has connected and synced
      // Ethos; the card hides the row when it is null.
      reputation: {
        credibilityScore: p.reputation?.credibilityScore ?? null,
      },
      // Minimal context only. No prices, no PnL, no execution (D-009).
      passes: active.map((a) => ({
        publicId: a.publicId,
        asset: a.asset,
        direction: a.direction,
        status: a.status,
      })),
      // Public profile URL convention per docs/DECISIONS.md D-019.3.
      profileUrl: `${ctx.env.APP_URL}/u/${p.profile.slug}`,
    };
  });
}

async function slugForTrader(ctx: AppContext, traderId: string): Promise<string> {
  const { getProfileByUserId } = await import("../services/profile-service.js");
  const p = await getProfileByUserId(ctx, traderId);
  if (!p) throw new AppError("PROFILE_NOT_FOUND");
  return p.slug;
}

export { getPassById };