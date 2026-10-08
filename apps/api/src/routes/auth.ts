import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { CreateProfileRequest, UpdateProfileRequest } from "@pass/contracts";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { users } from "@pass/db";
import {
  clearSessionCookie,
  createSession,
  requireUser,
  setSessionCookie,
} from "../plugins/session.js";
import {
  createProfile,
  getEthosProfile,
  getProfileByUserId,
  getTradingAccounts,
  getXConnection,
  getXIdentity,
  updateProfile,
  upsertXConnection,
  upsertXIdentity,
} from "../services/profile-service.js";
import { AppError } from "../errors.js";
import { pkceChallenge, randomToken } from "../crypto.js";

/**
 * Session and identity routes.
 *
 * A display-name session bootstrap keeps the MVP fully usable with no
 * credentials (mock mode). Real X OAuth runs only when X_MODE=live
 * (Stage H). No secret ever leaves the server, and no key material is ever
 * accepted by any route.
 */
export async function registerAuthRoutes(app: FastifyInstance, ctx: AppContext) {
  const secure = ctx.env.NODE_ENV === "production";

  app.post("/api/v1/auth/session", async (req, reply) => {
    const body = z
      .object({ displayName: z.string().min(1).max(80).optional() })
      .parse(req.body ?? {});

    const inserted = await ctx.db.insert(users).values({}).returning();
    const user = inserted[0];
    if (!user) throw new AppError("INTERNAL_ERROR");

    const sessionId = await createSession(ctx, user.id);
    setSessionCookie(reply, sessionId, secure);

    return {
      userId: user.id,
      displayName: body.displayName ?? null,
      profile: null,
      connections: [],
      demoMode: ctx.demoMode,
    };
  });

  app.get("/api/v1/me", async (req) => {
    const userId = await requireUser(req);
    const [profile, xIdentity, xConn, accounts, ethos] = await Promise.all([
      getProfileByUserId(ctx, userId),
      getXIdentity(ctx, userId),
      getXConnection(ctx, userId),
      getTradingAccounts(ctx, userId),
      getEthosProfile(ctx, userId),
    ]);

    return {
      userId,
      profileSlug: profile?.slug ?? null,
      displayName: profile?.name ?? null,
      connections: [
        {
          provider: "x",
          connected: Boolean(xIdentity),
          label: xConn
            ? `X connected · @${xConn.xHandle}`
            : xIdentity
              ? `X linked · @${xIdentity.username} (display only)`
              : "X not connected",
          displayOnly: Boolean(xIdentity && !xConn),
        },
        {
          provider: "hyperliquid",
          connected: accounts.length > 0,
          label:
            accounts.length > 0
              ? `Hyperliquid · ${accounts.length} account(s)`
              : "Hyperliquid not linked",
          displayOnly: false,
        },
        {
          provider: "ethos",
          connected: Boolean(ethos?.providerProfileId),
          label: ethos?.providerProfileId
            ? "Ethos reputation resolved"
            : "Ethos reputation not resolved",
          displayOnly: true,
        },
      ],
      tradingAccounts: accounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        accountAddress: a.accountAddress,
        agentAddress: a.agentAddress,
        isPrimary: a.isPrimary,
      })),
      demoMode: ctx.demoMode,
    };
  });

  app.post("/api/v1/auth/logout", async (req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.post("/api/v1/profiles", async (req) => {
    const userId = await requireUser(req);
    const input = CreateProfileRequest.parse(req.body);
    const profile = await createProfile(ctx, userId, input);
    return profile;
  });

  app.patch("/api/v1/profiles/me", async (req) => {
    const userId = await requireUser(req);
    const input = UpdateProfileRequest.parse(req.body);
    await updateProfile(ctx, userId, input);
    return { ok: true };
  });

  /**
   * X connection start. In live mode this returns the real OAuth URL with
   * state and PKCE. In mock mode it links a display-only identity so the
   * X OAuth entry point.
   *
   * MUST NOT require an existing PASS session. This is the route a brand-new
   * user arrives at, so requiring a session made the flow unreachable: it
   * answered AUTH_REQUIRED to exactly the people it exists for. The session is
   * created at the END, in the callback, once X has told us who the user is.
   *
   * A session IS honoured when one happens to exist: a signed-in user who
   * reconnects X should land on their existing account, not a second one.
   *
   * Responds 302 to X's authorize endpoint. It previously returned
   * `{mode, url, state}` as JSON, which meant the browser had to be told where
   * to go by JavaScript instead of actually being sent there — and the
   * authorize URL, which carries `state` and the PKCE challenge, was then
   * visible in a response body rather than in a Location header.
   */
  app.get("/api/v1/auth/x/start", async (req, reply) => {
    const state = randomToken(24);
    const verifier = randomToken(32);

    const { oauthStates } = await import("@pass/db");
    await ctx.db.insert(oauthStates).values({
      state,
      provider: "x",
      // Bound to the existing session when there is one, so the callback knows
      // which account to attach X to. Null for a first-time visitor.
      userId: req.sessionUserId ?? null,
      codeVerifier: verifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    if (ctx.adapters.x.mode !== "live") {
      // Mock mode has no X to redirect to. JSON rather than a 302 to nowhere.
      return {
        mode: "mock" as const,
        url: null,
        state,
        userId: req.sessionUserId ?? null,
      };
    }

    if (!ctx.env.X_CLIENT_ID || !ctx.env.X_REDIRECT_URI) {
      throw new AppError("IDENTITY_NOT_CONNECTED", "X OAuth is not configured.");
    }
    const url = ctx.adapters.x.buildAuthorizationUrl({
      clientId: ctx.env.X_CLIENT_ID,
      redirectUri: ctx.env.X_REDIRECT_URI,
      state,
      codeChallenge: pkceChallenge(verifier),
      scope: "tweet.read tweet.write users.read offline.access",
    });

    return reply.redirect(url);
  });

  /** Mock-mode X link. Requires no credentials and stores no token. */
  app.post("/api/v1/auth/x/link-mock", async (req) => {
    const userId = await requireUser(req);
    const body = z.object({ handle: z.string().min(1).max(40) }).parse(req.body);
    if (ctx.adapters.x.mode === "live") {
      throw new AppError("FORBIDDEN", "Mock linking is disabled when X_MODE=live.");
    }
    const resolved = await ctx.adapters.x.resolveIdentity(body.handle);
    if (!resolved) throw new AppError("IDENTITY_NOT_CONNECTED", "Handle not found.");

    await upsertXIdentity(ctx, userId, {
      xUserId: resolved.xUserId,
      handle: resolved.handle,
      displayName: resolved.displayName,
      avatarUrl: resolved.avatarUrl,
    });

    return { handle: resolved.handle, displayName: resolved.displayName, mode: "mock" };
  });

  app.get("/api/v1/auth/x/callback", async (req, reply) => {
    const query = z
      .object({
        state: z.string().optional(),
        code: z.string().optional(),
        error: z.string().optional(),
      })
      .parse(req.query ?? {});

    if (query.error) {
      return reply.redirect(`${ctx.env.APP_URL}/settings?x=denied`);
    }
    if (!query.state) {
      throw new AppError("AUTH_REQUIRED", "Missing OAuth state.");
    }

    const { oauthStates } = await import("@pass/db");
    const rows = await ctx.db
      .select()
      .from(oauthStates)
      .where(eq(oauthStates.state, query.state))
      .limit(1);
    const stored = rows[0];
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new AppError("AUTH_REQUIRED", "OAuth state is invalid or expired.");
    }
    await ctx.db.delete(oauthStates).where(eq(oauthStates.state, query.state));

    if (ctx.adapters.x.mode !== "live") {
      return reply.redirect(`${ctx.env.APP_URL}/settings?x=mock_pending`);
    }

    // Live callback: exchange the code server-side. Tokens are encrypted at
    // rest and never returned to the browser (docs/SECURITY_SPEC.md §8).
    if (!query.code) {
      throw new AppError("AUTH_REQUIRED", "Missing authorization code.");
    }

    /**
     * Resolve the PASS account.
     *
     * Three cases, in order:
     *  1. a live session exists  -> attach X to that user (reconnect);
     *  2. the state row recorded a userId at /start -> same, across the redirect
     *     where the cookie may not have survived;
     *  3. neither -> CREATE a PASS user. This is the first-time path, and it is
     *     the reason the callback must not call requireUser: X has now told us
     *     who the user is, which is strictly more information than a session
     *     cookie we would have required before starting.
     */
    const boundUserId = req.sessionUserId ?? stored.userId ?? null;
    let userId = boundUserId;
    if (!userId) {
      const inserted = await ctx.db.insert(users).values({}).returning();
      const created = inserted[0];
      if (!created) throw new AppError("INTERNAL_ERROR", "Could not create the user.");
      userId = created.id;
    }

// Token exchange. Authorization Code + PKCE.
//
// The client secret IS required here even though PKCE already proves the
// caller is the one who started the flow: X treats an app registered with a
// secret as a CONFIDENT client and rejects a token request that omits it with
// `unauthorized_client`. It is sent as HTTP Basic, which is X's documented
// method and keeps it out of the request body where it is more likely to be
// captured by logging middleware.
const clientId = ctx.env.X_CLIENT_ID ?? "";
const clientSecret = ctx.env.X_CLIENT_SECRET ?? "";
if (!clientId || !clientSecret) {
  throw new AppError(
    "IDENTITY_NOT_CONNECTED",
    "X OAuth is not configured: X_CLIENT_ID and X_CLIENT_SECRET must both be set.",
  );
}

const tokenRes = await fetch("https://api.x.com/2/oauth2/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
  },
  body: new URLSearchParams({
    code: query.code,
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: ctx.env.X_REDIRECT_URI ?? "",
    // The PKCE verifier minted at /auth/x/start. Without it the exchange fails
    // even with a valid code.
    code_verifier: stored.codeVerifier ?? "",
  }),
});
    if (!tokenRes.ok) {
      throw new AppError("IDENTITY_NOT_CONNECTED", "X token exchange failed.");
    }
    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    /**
     * Identity resolution goes through the provider adapter, not a bare fetch
     * here. AGENTS.md requires provider-specific calls to live behind an
     * integration module, and the inline version that used to be here was the
     * reason this step failed invisibly: it discarded X's status code and body,
     * so a 401 (bad token) and a 403 (missing users.read) were indistinguishable.
     *
     * `/2/users/me` with the USER access token — not `/2/users/by/username/...`,
     * which needs a handle we do not have after an exchange, and not the app
     * bearer token, which X answers 403 for a user-context endpoint.
     */
    let profile;
    try {
      profile = await ctx.adapters.x.getAuthenticatedUser(tokens.access_token ?? "");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // Logged so it is visible in the deploy logs, and returned in the error
      // detail so the operator can see exactly what X said. The adapter has
      // already redacted tokens from this text.
      ctx.log.error("X identity resolution failed", {
        path: req.url,
        status: (err as { status?: number }).status ?? null,
        reason,
      });
      throw new AppError(
        "IDENTITY_NOT_CONNECTED",
        `Could not resolve the X profile. ${reason}`.slice(0, 400),
      );
    }

    await upsertXIdentity(ctx, userId, {
      xUserId: profile.xUserId,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
    await upsertXConnection(ctx, userId, {
      xUserId: profile.xUserId,
      xHandle: profile.handle,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
      scopes: tokens.scope ? tokens.scope.split(" ") : null,
    });

    // The session is issued HERE, at the end of the flow, which is the only
    // point at which the user is authenticated. Before this change a first-time
    // user could not obtain one at all.
    const sessionId = await createSession(ctx, userId);
    setSessionCookie(reply, sessionId, secure);

    return reply.redirect(`${ctx.env.APP_URL}/settings?x=connected`);
  });

  app.post("/api/v1/auth/x/disconnect", async (req) => {
    const userId = await requireUser(req);
    const { xConnections, identities } = await import("@pass/db");
    const { and } = await import("drizzle-orm");
    await ctx.db.delete(xConnections).where(eq(xConnections.userId, userId));
    await ctx.db
      .delete(identities)
      .where(and(eq(identities.userId, userId), eq(identities.provider, "x")));
    return { ok: true };
  });

  app.get("/api/v1/auth/debug/session", async (req) => ({
    userId: req.sessionUserId ?? null,
    requestId: randomUUID(),
  }));
}