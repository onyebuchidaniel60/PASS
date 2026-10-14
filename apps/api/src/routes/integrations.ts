import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";
import { requireUser } from "../plugins/session.js";
import {
  currentVenue,
  getEthosProfile,
  getTradingAccounts,
  linkTradingAccount,
  recordAgentApproval,
  recordAgentApprovalById,
  refreshEthosReputation,
  resolveTradingAccountByAddress,
  visibleAgentAddress,
} from "../services/profile-service.js";
import { AppError } from "../errors.js";
import { ETHOS_DISCLAIMER } from "../services/profile-service.js";

const ApproveAgentBody = z
  .object({
    agentAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    nonce: z.number().int().positive(),
    signature: z.record(z.unknown()),
  })
  // Strict: any extra field is refused. This guarantees the endpoint can
  // never be handed key material (D-018.9, D-019.1).
  .strict();

type ApproveAgentInput = z.infer<typeof ApproveAgentBody>;

/**
 * Shared approve-agent core (D-027): resolve the wallet's row by
 * (provider, account_address) — creating it user-less on first use — relay
 * the client-signed action, and record the approval by row id. No session
 * is read and no user_id is checked; the master wallet signature carried
 * in the body is the approval authority.
 */
async function approveAgentForAddress(
  ctx: AppContext,
  accountAddress: string,
  body: ApproveAgentInput,
) {
  const normalized = accountAddress.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
    throw new AppError("INVALID_REQUEST", "That is not a valid EVM address.");
  }
  const row = await resolveTradingAccountByAddress(ctx, normalized);
  const agentAddress = body.agentAddress.toLowerCase();

  // Relayed through the provider adapter so mock mode simulates the approval
  // and never contacts the live Hyperliquid endpoint (D-018.9). The venue
  // label travels with the action: testnet requires hyperliquidChain
  // "Testnet" (a "Mainnet" approval is rejected or misfiled there), and it
  // must match the label the client signed.
  //
  // TEMP diagnostic (remove once the testnet approval is confirmed): the
  // exact action Hyperliquid reconstructs the signature hash from. The
  // signature itself is never logged (SECURITY_SPEC.md §16) — only the
  // public action fields the hash is built over.
  const relayLabel = currentVenue(ctx) === "testnet" ? "Testnet" : "Mainnet";
  ctx.log.info("approveAgent relay body", {
    action: {
      type: "approveAgent",
      hyperliquidChain: relayLabel,
      signatureChainId: relayLabel === "Testnet" ? "0x66eee" : "0xa4b1",
      agentAddress,
      agentName: "",
      nonce: body.nonce,
    },
    nonce: body.nonce,
  });
  try {
    await ctx.adapters.hyperliquid.relayApproveAgent({
      agentAddress,
      nonce: body.nonce,
      signature: body.signature,
      hyperliquidChain: relayLabel,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/reject|recover signer|err/i.test(msg)) {
      throw new AppError("SIGNATURE_REJECTED", `Hyperliquid rejected the agent approval: ${msg.slice(0, 200)}`);
    }
    throw new AppError("PROVIDER_UNAVAILABLE", `Could not reach Hyperliquid: ${msg.slice(0, 160)}`);
  }

  // Recorded only after the provider accepted it, so a rejected approval
  // never leaves a stored agent association behind. Recorded by row id for
  // every row — owned or user-less — and no user_id is ever assigned here.
  await recordAgentApprovalById(ctx, row.id, agentAddress);

  return {
    ok: true,
    agentAddress,
    accountAddress: row.accountAddress,
    mode: ctx.adapters.hyperliquid.mode,
  };
}

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
        // Per-venue approval: stale-venue agents read as not-approved.
        agentAddress: visibleAgentAddress(ctx, a),
        agentApproved: Boolean(visibleAgentAddress(ctx, a) && a.agentApprovedAt),
        isPrimary: a.isPrimary,
      })),
    };
  });

  /**
   * Links a Hyperliquid account address. Only the address is ever sent to the
   * server. The agent private key is generated and held in the client; this
   * route can never receive it (docs/DECISIONS.md D-018.9).
   *
   * One ACTIVE wallet per user: linking a new address retires the caller's
   * existing rows (is_active = false, history intact — see
   * linkTradingAccount). Re-linking the same address is idempotent.
   */
  app.post("/api/v1/me/trading-accounts", async (req) => {
    const userId = await requireUser(req);
    const body = z
      .object({
        accountAddress: z.string().min(1),
        provider: z.literal("hyperliquid").optional(),
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
   * PASS-side unlink of a Hyperliquid account (distinct from a ConnectKit
   * browser disconnect, which never touches this row — D-019.1). Ownership
   * is resolved server-side (SECURITY_SPEC.md §10). An unknown id and
   * another user's id are deliberately indistinguishable.
   *
   * Soft unlink: the row is retired (is_active = false), never deleted, so
   * execution history keeps its FK target (D-008) and unlink is never
   * blocked — not even when executions reference the row.
   */
  app.delete<{ Params: { id: string } }>(
    "/api/v1/me/trading-accounts/:id",
    async (req) => {
      const userId = await requireUser(req);
      const { tradingAccounts } = await import("@pass/db");
      const { and, eq } = await import("drizzle-orm");
      const updated = await ctx.db
        .update(tradingAccounts)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(eq(tradingAccounts.id, req.params.id), eq(tradingAccounts.userId, userId)),
        )
        .returning({ id: tradingAccounts.id });
      if (updated.length === 0) {
        throw new AppError("FORBIDDEN", "That trading account is not yours.");
      }
      return { ok: true };
    },
  );

  /**
   * Approve an API/agent wallet (docs/DECISIONS.md D-019.1, D-027).
   *
   * D-027: wallets are execution devices, not owned. The route is keyed by
   * wallet address, needs no session, and never checks user_id (which is
   * informational only). Agent approval authority is the master wallet
   * signature: any session, or none, may POST. The client signs the
   * approveAgent EIP-712 payload with the MASTER wallet and submits only
   * the signature plus the agent address. This endpoint never receives a
   * private key (D-018.3, D-018.9) and relays to the Hyperliquid Exchange
   * API.
   */
  app.post<{ Params: { address: string } }>(
    "/api/v1/trading-accounts/:address/approve-agent",
    async (req) => {
      const body = ApproveAgentBody.parse(req.body);
      return approveAgentForAddress(ctx, req.params.address, body);
    },
  );

  /**
   * Deprecated alias of the address-keyed route above (D-027). Kept so
   * older clients keep working; new clients must use the address route.
   * The row id only locates the wallet — ownership is no longer checked.
   */
  app.post<{ Params: { id: string } }>(
    "/api/v1/me/trading-accounts/:id/approve-agent",
    async (req) => {
      const body = ApproveAgentBody.parse(req.body);
      const { tradingAccounts } = await import("@pass/db");
      const { eq } = await import("drizzle-orm");
      const found = await ctx.db
        .select({ accountAddress: tradingAccounts.accountAddress })
        .from(tradingAccounts)
        .where(eq(tradingAccounts.id, req.params.id))
        .limit(1);
      const row = found[0];
      // Unknown ids stay indistinguishable (docs/SECURITY_SPEC.md §10).
      if (!row) throw new AppError("FORBIDDEN", "That trading account is not yours.");
      return approveAgentForAddress(ctx, row.accountAddress, body);
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