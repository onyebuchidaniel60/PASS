import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/**
 * X callback — sign-in with a pre-existing identity binding.
 *
 * Regression test for the production `INTERNAL_ERROR`:
 * `duplicate key value violates unique constraint
 * "x_connections_x_user_id_key"`.
 *
 * When the callback runs without a session it created a fresh user and then
 * inserted an `x_connections` row for the X account — colliding with the row
 * the same X account already owned under its original user (bound before the
 * Vercel proxy existed). The callback never looked the identity up.
 * `DATA_MODEL.md` §2 requires `UNIQUE(provider, provider_subject_id)` on
 * `identities` precisely so the callback can resolve an external identity
 * back to its owning user (`API_CONTRACTS.md` §5).
 *
 * No secret material appears here: the token endpoint is stubbed and the
 * "tokens" are inert fixtures.
 */

const FIXTURE_SUBJECT = "x-subject-12345";
const FIXTURE_HANDLE = "fixturehandle";

function stubX(): XPort {
  return {
    mode: "live",
    resolveIdentity: async () => null,
    getAuthenticatedUser: async () => ({
      xUserId: FIXTURE_SUBJECT,
      handle: FIXTURE_HANDLE,
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

interface Harness {
  app: FastifyInstance;
  ctx: AppContext;
  handle: DbHandle;
  userId: string;
}

async function setupHarness(): Promise<Harness> {
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
  const handle = await createDb({ pglitePath: dir });
  await runMigrations(handle);

  const ctx: AppContext = {
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

  // Pre-existing binding: the X account already belongs to this user
  // (bound before the Vercel proxy existed, under the old cookie scope).
  const [user] = await ctx.db.insert(users).values({}).returning();
  if (!user) throw new Error("fixture setup failed");
  await ctx.db.insert(identities).values({
    userId: user.id,
    provider: "x",
    providerSubjectId: FIXTURE_SUBJECT,
    username: FIXTURE_HANDLE,
    displayName: "Fixture User",
    avatarUrl: null,
  });
  await ctx.db.insert(xConnections).values({
    userId: user.id,
    xUserId: FIXTURE_SUBJECT,
    xHandle: FIXTURE_HANDLE,
  });
  // Session-less sign-in: the state row records no user.
  await ctx.db.insert(oauthStates).values({
    state: "test-state",
    provider: "x",
    userId: null,
    codeVerifier: "test-verifier",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const app = await buildApp(ctx);
  return { app, ctx, handle, userId: user.id };
}

async function count(
  ctx: AppContext,
  table: typeof users | typeof xConnections,
): Promise<number> {
  return (await ctx.db.select().from(table as typeof users)).length;
}

beforeEach(() => {
  stubTokenExchange();
});

afterEach(async () => {
  vi.unstubAllGlobals();
});

describe("X callback with a pre-existing identity binding (no session)", () => {
  it("signs into the owning user instead of colliding", async () => {
    const { app, ctx, handle, userId } = await setupHarness();
    try {
      const usersBefore = await count(ctx, users);
      const connsBefore = await count(ctx, xConnections);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/x/callback?state=test-state&code=test-code",
      });

      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain("http://test.local/");
      expect(res.headers.location).toContain("x=connected");

      const setCookie = res.headers["set-cookie"];
      expect(setCookie).toBeDefined();

      // The session belongs to the pre-seeded user — no second user,
      // no second connection row.
      expect(await count(ctx, users)).toBe(usersBefore);
      expect(await count(ctx, xConnections)).toBe(connsBefore);
      const sessionRows = await ctx.db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId));
      expect(sessionRows.length).toBe(1);
    } finally {
      await app.close();
      await handle.close();
    }
  }, 120_000);

  it("does not create a duplicate users row on reconnect", async () => {
    const { app, ctx, handle } = await setupHarness();
    try {
      const usersBefore = await count(ctx, users);
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/x/callback?state=test-state&code=test-code",
      });
      expect(res.statusCode).toBe(302);
      expect(await count(ctx, users)).toBe(usersBefore);
    } finally {
      await app.close();
      await handle.close();
    }
  }, 120_000);
});
