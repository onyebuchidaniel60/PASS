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

  /**
   * Approve an API/agent wallet (docs/DECISIONS.md D-019.1).
   *
   * The client signs the approveAgent EIP-712 payload with the MASTER wallet
   * and submits only the signature plus the agent address. This endpoint never
   * receives a private key (D-018.3, D-018.9) and relays to the Hyperliquid
   * Exchange API.
   */
  app.post<{ Params: { id: string } }>(
    "/api/v1/me/trading-accounts/:id/approve-agent",
    async (req) => {
    const userId = await requireUser(req);
    const body = z
      .object({
        agentAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        nonce: z.number().int().positive(),
        signature: z.record(z.unknown()),
      })
      // Strict: any extra field is refused. This guarantees the endpoint can
      // never be handed key material (D-018.9, D-019.1).
      .strict()
      .parse(req.body);

    const accounts = await getTradingAccounts(ctx, userId);
    const account = accounts.find((a) => a.id === req.params.id);
    // Ownership is resolved server-side, never trusted from the client
    // (docs/SECURITY_SPEC.md §10).
    if (!account) throw new AppError("FORBIDDEN", "That trading account is not yours.");

    const agentAddress = body.agentAddress.toLowerCase();

    // Relayed through the provider adapter so mock mode simulates the approval
    // and never contacts the live Hyperliquid endpoint (D-018.9).
    try {
      await ctx.adapters.hyperliquid.relayApproveAgent({
        agentAddress,
        nonce: body.nonce,
        signature: body.signature,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/reject|recover signer|err/i.test(msg)) {
        throw new AppError("SIGNATURE_REJECTED", `Hyperliquid rejected the agent approval: ${msg.slice(0, 200)}`);
      }
      throw new AppError("PROVIDER_UNAVAILABLE", `Could not reach Hyperliquid: ${msg.slice(0, 160)}`);
    }

    // Recorded only after the provider accepted it, so a rejected approval
    // never leaves a stored agent association behind.
    await recordAgentApproval(ctx, userId, account.accountAddress, agentAddress);

    return {
      ok: true,
      agentAddress,
      accountAddress: account.accountAddress,
      mode: ctx.adapters.hyperliquid.mode,
    };
    },
  );

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