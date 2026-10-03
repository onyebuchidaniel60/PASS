import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import { requireUser } from "../plugins/session.js";
import {
  getEthosProfile,
  getTradingAccounts,
  linkTradingAccount,
  recordAgentApproval,
  refreshEthosReputation,
} from "../services/profile-service.js";
import { AppError } from "../errors.js";
import { ETHOS_DISCLAIMER } from "../services/profile-service.js";

export async function registerIntegrationRoutes(app: FastifyInstance, ctx: AppContext) {
  /**
   * D-018.7 — refresh operates only on the authenticated caller's own linked
   * identity. There is no public-identity scope.
   */
  app.post("/api/v1/integrations/ethos/refresh", async (req) => {
    const userId = await requireUser(req);
    const result = await refreshEthosReputation(ctx, userId);
    const profile = await getEthosProfile(ctx, userId);
    return {
      providerProfileId: result.providerProfileId,
      syncedAt: result.syncedAt,
      credibilityScore:
        profile?.credibilityScore === null || profile?.credibilityScore === undefined
          ? null
          : Number(profile.credibilityScore),
      reviewsCount: profile?.reviewsCount ?? null,
      vouchesCount: profile?.vouchesCount ?? null,
      humanVerified: profile?.humanVerified ?? null,
      sourceUrl: profile?.sourceUrl ?? null,
      disclaimer: ETHOS_DISCLAIMER,
      mode: ctx.adapters.ethos.mode,
    };
  });

  app.get("/api/v1/integrations/ethos/me", async (req) => {
    const userId = await requireUser(req);
    const profile = await getEthosProfile(ctx, userId);
    if (!profile) {
      return {
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
    }
    return {
      source: "ethos",
      providerProfileId: profile.providerProfileId,
      credibilityScore:
        profile.credibilityScore === null ? null : Number(profile.credibilityScore),
      reviewsCount: profile.reviewsCount,
      vouchesCount: profile.vouchesCount,
      humanVerified: profile.humanVerified,
      sourceUrl: profile.sourceUrl,
      syncedAt: profile.syncedAt ? profile.syncedAt.toISOString() : null,
      disclaimer: ETHOS_DISCLAIMER,
    };
  });

  app.get("/api/v1/me/trading-accounts", async (req) => {
    const userId = await requireUser(req);
    const rows = await getTradingAccounts(ctx, userId);
    return {
      accounts: rows.map((a) => ({
        id: a.id,
        provider: a.provider,
        // account_address is the query subject for every Info API read.
        accountAddress: a.accountAddress,
        agentAddress: a.agentAddress,
        agentApproved: Boolean(a.agentApprovedAt),
        isPrimary: a.isPrimary,
      })),
    };
  });

  /**
   * Links a Hyperliquid account address. Only the address is ever sent to the
   * server. The agent private key is generated and held in the client; this
   * route can never receive it (docs/DECISIONS.md D-018.9).
   */
  app.post("/api/v1/me/trading-accounts", async (req) => {
    const userId = await requireUser(req);
    const body = z
      .object({
        accountAddress: z.string().min(1),
        agentAddress: z.string().min(1).nullable().optional(),
        isPrimary: z.boolean().optional(),
      })
      .parse(req.body);
    return linkTradingAccount(ctx, userId, body.accountAddress, {
      agentAddress: body.agentAddress ?? null,
      isPrimary: body.isPrimary,
    });
  });

  app.post("/api/v1/me/trading-accounts/agent-approved", async (req) => {
    const userId = await requireUser(req);
    const body = z
      .object({ accountAddress: z.string().min(1), agentAddress: z.string().min(1) })
      .parse(req.body);
    await recordAgentApproval(ctx, userId, body.accountAddress, body.agentAddress);
    return { ok: true };
  });

  app.get("/api/v1/markets", async () => {
    try {
      const assets = await ctx.adapters.hyperliquid.listAssets();
      const mids = await ctx.adapters.hyperliquid.getMids();
      return {
        mode: ctx.adapters.hyperliquid.mode,
        assets: assets.map((a) => ({ ...a, midPrice: mids[a.asset] ?? null })),
      };
    } catch {
      throw new AppError("PROVIDER_UNAVAILABLE");
    }
  });

  app.get<{ Params: { asset: string } }>("/api/v1/markets/:asset", async (req) => {
    try {
      const snapshot = await ctx.adapters.hyperliquid.getSnapshot(req.params.asset);
      if (!snapshot) throw new AppError("INVALID_ASSET");
      return { ...snapshot, mode: ctx.adapters.hyperliquid.mode };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("PROVIDER_UNAVAILABLE");
    }
  });

  /**
   * Account state read. Requires account_address, never agent_address
   * (D-018.3). Ownership is verified server-side.
   */
  app.get("/api/v1/me/account-state", async (req) => {
    const userId = await requireUser(req);
    const accounts = await getTradingAccounts(ctx, userId);
    const account = accounts.find((a) => a.isPrimary) ?? accounts[0];
    if (!account) {
      throw new AppError("IDENTITY_NOT_CONNECTED", "Link a Hyperliquid account first.");
    }
    const state = await ctx.adapters.hyperliquid.getAccountState(account.accountAddress);
    return {
      accountAddress: account.accountAddress,
      state,
      mode: ctx.adapters.hyperliquid.mode,
    };
  });
}