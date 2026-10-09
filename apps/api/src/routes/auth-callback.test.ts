import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  createDb,
  identities,
  oauthStates,
  runMigrations,
  sessions,
  users,
  xConnections,
  type DbHandle,
} from "@pass/db";
import { MockEthos, MockHyperliquid, type XPort } from "@pass/integrations";
import type { ApiEnv } from "@pass/contracts";
import { buildApp } from "../app.js";
import type { AppContext } from "../context.js";
import { loadEnv, resetEnv } from "../env.js";
import { createLogger } from "../logger.js";
import { createSession } from "../plugins/session.js";

/**
 * X callback — sign-in with a pre-existing identity binding.
 *
 * Regression test for the production `INTERNAL_ERROR`:
 * `duplicate key value violates unique constraint
 * "x_connections_x_user_id_key"`.
 *
 * When the callback ran without a session it created a fresh user and then
 * inserted an `x_connections` row for the X account — colliding with the row
 * the same X account already owned under its original user (bound before the
 * Vercel proxy existed). The callback never looked the identity up.
 * `DATA_MODEL.md` §2 requires `UNIQUE(provider, provider_subject_id)` on
 * `identities` precisely so the callback can resolve an external identity
 * back to its owning user (`API_CONTRACTS.md` §5).
 *
 * One PGlite boot per FILE (beforeAll): boots cost 10s+ idle and minutes
 * under parallel load, so per-test boots flaked the suite. Tests stay
 * isolated through distinct fixtures (subjects, states, users).
 *
 * No secret material appears here: the token endpoint is stubbed and the
 * "tokens" are inert fixtures.
 */

let currentSubject = "x-subject-1";
let currentHandle = "fixturehandle1";

function stubX(): XPort {
  return {
    mode: "live",
    resolveIdentity: async () => null,
    getAuthenticatedUser: async () => ({
      xUserId: currentSubject,
      handle: currentHandle,
      displayName: "Fixture User",
      avatarUrl: null,
    }),
    createPost: async () => {
      throw new Error("not under test");
    },
    buildAuthorizationUrl: () => "https://x.test/authorize",
  };
}

function stubTokenExchange(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      if (String(url) === "https://api.x.com/2/oauth2/token") {
        return new Response(
          JSON.stringify({
            access_token: "fixture-access-token",
            refresh_token: "fixture-refresh-token",
            expires_in: 7200,
            scope: "tweet.read users.read offline.access",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`unexpected fetch in test: ${String(url)}`);
    }),
  );
}

let app: FastifyInstance;
let handle: DbHandle;
let ctx: AppContext;

async function seedBinding(suffix: string): Promise<{ userId: string; state: string }> {
  const subject = `x-subject-${suffix}`;
  const state = `test-state-${suffix}`;
  const [user] = await ctx.db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await ctx.db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: subject,
    username: `fixturehandle${suffix}`,
    displayName: "Fixture User",
    avatarUrl: null,
  });
  await ctx.db.insert(xConnections).values({
    userId: user.id,
    xUserId: subject,
    xHandle: `fixturehandle${suffix}`,
  });
  // Session-less sign-in: the state row records no user.
  await ctx.db.insert(oauthStates).values({
    state,
    provider: "x",
    userId: null,
    codeVerifier: "test-verifier",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  return { userId: user.id, state };
}

async function count(
  table: typeof users | typeof xConnections,
): Promise<number> {
  return (await ctx.db.select().from(table as typeof users)).length;
}

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-oauth-callback";
  resetEnv();
  const env: ApiEnv = {
    ...loadEnv(),
    APP_URL: "http://test.local",
    X_CLIENT_ID: "test-client-id",
    X_CLIENT_SECRET: "test-client-secret",
    X_REDIRECT_URI: "http://test.local/api/v1/auth/x/callback",
  };

  const dir = mkdtempSync(join(tmpdir(), "pass-auth-callback-test-"));
  handle = await createDb({ pglitePath: dir });
  await runMigrations(handle);

  ctx = {
    env,
    db: handle.db,
    handle,
    adapters: {
      hyperliquid: new MockHyperliquid(),
      ethos: new MockEthos(),
      x: stubX(),
      modes: {
        hyperliquid: "mock",
        hyperliquidReads: "mock",
        hyperliquidExecution: "mock",
        ethos: "mock",
        x: "live",
        database: "mock",
      },
    },
    log: createLogger("test"),
    demoMode: false,
    close: handle.close,
  };
  app = await buildApp(ctx);
}, 240_000);

afterAll(async () => {
  await app.close();
  await handle.close();
});

beforeEach(() => {
  stubTokenExchange();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("X callback with a pre-existing identity binding (no session)", () => {
  it("signs into the owning user instead of colliding", async () => {
    currentSubject = "x-subject-collide";
    currentHandle = "fixturehandlecollide";
    const { userId, state } = await seedBinding("collide");
    const usersBefore = await count(users);
    const connsBefore = await count(xConnections);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/auth/x/callback?state=${state}&code=test-code`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("http://test.local/");
    expect(res.headers.location).toContain("x=connected");

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();

    // The session belongs to the pre-seeded user — no second user,
    // no second connection row.
    expect(await count(users)).toBe(usersBefore);
    expect(await count(xConnections)).toBe(connsBefore);
    const sessionRows = await ctx.db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId));
    expect(sessionRows.length).toBe(1);
  }, 180_000);

  it("does not create a duplicate users row on reconnect", async () => {
    currentSubject = "x-subject-reconnect";
    currentHandle = "fixturehandlereconnect";
    const { state } = await seedBinding("reconnect");
    const usersBefore = await count(users);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/auth/x/callback?state=${state}&code=test-code`,
    });
    expect(res.statusCode).toBe(302);
    expect(await count(users)).toBe(usersBefore);
  }, 180_000);

  it("reconnect after disconnect returns the same user, history intact (D-024)", async () => {
    currentSubject = "x-subject-rejoin";
    currentHandle = "fixturehandlerejoin";
    const { userId, state } = await seedBinding("rejoin");
    const sid = await createSession(ctx, userId);
    const jar = `pass_session=${sid}`;

    // Disconnect terminates the session (D-024).
    const out = await app.inject({
      method: "POST",
      url: "/api/v1/auth/x/disconnect",
      headers: { cookie: jar },
    });
    expect(out.statusCode).toBe(200);
    const dead = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: jar },
    });
    expect(dead.statusCode).toBe(401);

    // Reconnecting signs back into the SAME user — no new user, and the
    // new session resolves the original userId.
    const usersBefore = await count(users);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/auth/x/callback?state=${state}&code=test-code`,
    });
    expect(res.statusCode).toBe(302);
    expect(await count(users)).toBe(usersBefore);
    const match = /pass_session=([^;]+)/.exec(String(res.headers["set-cookie"] ?? ""));
    expect(match?.[1]).toBeTruthy();
    const me = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: `pass_session=${match![1]}` },
    });
    expect(me.statusCode).toBe(200);
    expect((JSON.parse(me.body) as { userId: string }).userId).toBe(userId);
  }, 180_000);
});
