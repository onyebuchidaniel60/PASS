import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createDb,
  identities,
  runMigrations,
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
import { SESSION_COOKIE, createSession } from "../plugins/session.js";

/**
 * `GET /api/v1/me` — the X `connections[]` entry carries a machine-readable
 * `handle`.
 *
 * The web client's identity control crashed production because it assumed a
 * nested `x` object that never existed on the wire. The canonical shape is
 * the flat `connections[]` array; the control derives from it. The handle is
 * exposed as data (not parsed from the display `label`) so the client never
 * couples to display copy. This test pins the contract: connected entry
 * carries the connection handle, display-only entry carries the identity
 * username, unconnected entry carries null.
 */
function stubX(): XPort {
  return {
    mode: "mock",
    resolveIdentity: async () => null,
    getAuthenticatedUser: async () => {
      throw new Error("not under test");
    },
    createPost: async () => {
      throw new Error("not under test");
    },
    buildAuthorizationUrl: () => "https://x.test/authorize",
  };
}

interface Harness {
  app: FastifyInstance;
  handle: DbHandle;
}

async function setupHarness(): Promise<Harness> {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-me-shape";
  resetEnv();
  const env: ApiEnv = { ...loadEnv(), APP_URL: "http://test.local" };
  const dir = mkdtempSync(join(tmpdir(), "pass-auth-me-test-"));
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
        x: "mock",
        database: "mock",
      },
    },
    log: createLogger("test"),
    demoMode: false,
    close: handle.close,
  };
  return { app: await buildApp(ctx), handle };
}

describe("GET /api/v1/me x-entry handle", () => {
  let harness: Harness | null = null;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("no network in test");
      }),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (harness) {
      await harness.app.close();
      await harness.handle.close();
      harness = null;
    }
  });

  it("exposes the connection handle when X is connected", async () => {
    harness = await setupHarness();
    const { app, handle } = harness;
    const [user] = await handle.db.insert(users).values({}).returning();
    if (!user) throw new Error("fixture setup failed");
    await handle.db.insert(identities).values({
      userId: user.id,
      provider: "x",
      providerSubjectId: "x-subject-1",
      username: "oldhandle",
      displayName: null,
      avatarUrl: null,
    });
    await handle.db.insert(xConnections).values({
      userId: user.id,
      xUserId: "x-subject-1",
      xHandle: "newhandle",
    });
    const sessionId = await createSession(
      { db: handle.db } as unknown as AppContext,
      user.id,
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      connections: Array<{
        provider: string;
        connected: boolean;
        displayOnly: boolean;
        handle: string | null;
      }>;
    };
    const x = body.connections.find((c) => c.provider === "x");
    expect(x).toMatchObject({ connected: true, displayOnly: false, handle: "newhandle" });
  });

  it("exposes the identity username when display-only, null when unconnected", async () => {
    harness = await setupHarness();
    const { app, handle } = harness;
    const [user] = await handle.db.insert(users).values({}).returning();
    if (!user) throw new Error("fixture setup failed");
    await handle.db.insert(identities).values({
      userId: user.id,
      provider: "x",
      providerSubjectId: "x-subject-2",
      username: "displayhandle",
      displayName: null,
      avatarUrl: null,
    });
    const sessionId = await createSession(
      { db: handle.db } as unknown as AppContext,
      user.id,
    );

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { cookie: `${SESSION_COOKIE}=${sessionId}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      connections: Array<{ provider: string; displayOnly: boolean; handle: string | null }>;
    };
    const x = body.connections.find((c) => c.provider === "x");
    expect(x).toMatchObject({ displayOnly: true, handle: "displayhandle" });
  });
});
