/**
 * PASS golden-path smoke test.
 *
 * Walks the definition of done from docs/AI_HANDOFF.md against a running API:
 *   Trader: connect identity -> create Pass -> publish -> share
 *   Taker:  open Pass -> inspect -> choose own size -> review -> execute -> status
 *
 * Uses only the public HTTP surface, exactly as a browser would.
 * Requires the API to be running (default http://127.0.0.1:4000).
 */

const BASE = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

class Session {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorb(res) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  async call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        // Only declare a JSON content-type when a body is actually sent.
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(this.cookies.size > 0 ? { Cookie: this.header() } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    this.absorb(res);
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  }

  get = (p) => this.call("GET", p);
  post = (p, b) => this.call("POST", p, b);
  patch = (p, b) => this.call("PATCH", p, b);
}

async function main() {
  console.log(`\nPASS smoke test against ${BASE}\n`);

  // ---------------------------------------------------------------- health
  console.log("Health");
  const anon = new Session();
  const health = await anon.get("/health");
  check("GET /health returns ok", health.status === 200 && health.body?.status === "ok", JSON.stringify(health.body));
  check(
    "provider modes reported",
    Boolean(health.body?.modes?.hyperliquid && health.body?.modes?.ethos && health.body?.modes?.x),
    JSON.stringify(health.body?.modes),
  );

  // ------------------------------------------------------------- trader
  console.log("\nTrader journey");
  const trader = new Session();
  const session = await trader.post("/api/v1/auth/session", { displayName: "Smoke Trader" });
  check("create session", session.status === 200 && Boolean(session.body?.userId), JSON.stringify(session.body));

  const profile = await trader.post("/api/v1/profiles", {
    slug: `smoke${Date.now().toString(36).slice(-6)}`,
    displayName: "Smoke Trader",
    bio: "BTC / ETH perpetual trader",
  });
  check("create profile", profile.status === 200 && Boolean(profile.body?.slug), JSON.stringify(profile.body));
  const traderSlug = profile.body?.slug;

  const linkX = await trader.post("/api/v1/auth/x/link-mock", { handle: "smokeTrader" });
  check(
    "connect X identity (display-only in mock)",
    linkX.status === 200 && linkX.body?.handle === "smokeTrader",
    JSON.stringify(linkX.body),
  );

  const account = await trader.post("/api/v1/me/trading-accounts", {
    accountAddress: "0x1111111111111111111111111111111111111111",
  });
  check("link Hyperliquid account", account.status === 200 && Boolean(account.body?.id), JSON.stringify(account.body));
  const traderAccountId = account.body?.id;

  const ethos = await trader.post("/api/v1/integrations/ethos/refresh");
  check("resolve Ethos reputation", ethos.status === 200, JSON.stringify(ethos.body));
  check(
    "Ethos response carries the non-verdict disclaimer",
    typeof ethos.body?.disclaimer === "string" && ethos.body.disclaimer.length > 20,
    ethos.body?.disclaimer,
  );

  // Draft -> publish (Stage C gate)
  const created = await trader.post("/api/v1/passes", {
    asset: "BTC",
    direction: "long",
    entryType: "limit",
    entryPrice: "113400",
    stopLoss: "111900",
    takeProfit: "116000",
    leverage: "5",
    thesis: "BTC reclaiming resistance with increasing volume.",
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  });
  check("create Pass draft", created.status === 200 && created.body?.version === 1, JSON.stringify(created.body));
  const passId = created.body?.id;

  const published = await trader.post(`/api/v1/passes/${passId}/publish`);
  check("publish Pass", published.status === 200 && published.body?.status === "active", JSON.stringify(published.body));
  const publicId = published.body?.publicId;

  // Editing an execution-relevant field must mint a new version (D-018.5)
  const edited = await trader.patch(`/api/v1/passes/${passId}`, {
    version: 1,
    takeProfit: "117500",
  });
  check(
    "edit execution-relevant field bumps version to 2",
    edited.status === 200 && edited.body?.version === 2,
    JSON.stringify(edited.body),
  );

  const detail = await trader.get(`/api/v1/me/passes/${passId}`);
  check(
    "version 2 and 1 both recorded in history",
    detail.body?.version === 2 &&
      Array.isArray(detail.body?.events) &&
      detail.body.events.some((e) => e.passVersion === 1) &&
      detail.body.events.some((e) => e.passVersion === 2),
    JSON.stringify(detail.body?.events?.map((e) => [e.eventType, e.passVersion])),
  );

  const mine = await trader.get("/api/v1/me/passes");
  check("own Pass appears in My Passes", (mine.body?.passes?.length ?? 0) >= 1, JSON.stringify(mine.body?.passes?.length));

  const dash = await trader.get("/api/v1/me/dashboard");
  check("dashboard returns counts", dash.status === 200 && typeof dash.body?.counts?.active === "number", JSON.stringify(dash.body?.counts));

  // -------------------------------------------------------------- public
  console.log("\nPublic experience (logged out)");
  const visitor = new Session();
  const pub = await visitor.get(`/api/v1/passes/${publicId}`);
  check("logged-out browser can open the Pass", pub.status === 200, JSON.stringify(pub.body).slice(0, 200));
  check("Pass shows asset and direction", pub.body?.asset === "BTC" && pub.body?.direction === "long");
  check("Pass carries trader identity", Boolean(pub.body?.trader?.slug), JSON.stringify(pub.body?.trader));
  check("Pass carries reputation context separately", pub.body?.reputation !== undefined);
  check("Pass carries a market snapshot", Boolean(pub.body?.market?.markPrice), JSON.stringify(pub.body?.market));
  check("canonical path is /p/{publicId}", pub.body?.canonicalPath === `/p/${publicId}`);

  const discover = await visitor.get("/api/v1/discover");
  check("discover lists the Pass", (discover.body?.passes ?? []).some((p) => p.publicId === publicId), String(discover.body?.passes?.length));

  const prof = await visitor.get(`/api/v1/profiles/${traderSlug}`);
  check("public profile resolves", prof.status === 200 && prof.body?.slug === traderSlug);
  check("profile separates performance from reputation", "performance" in (prof.body ?? {}) && "reputation" in (prof.body ?? {}));
  check("no synthetic trust score on profile", !("trustScore" in (prof.body ?? {})) && !("trust_score" in (prof.body ?? {})));

  const rep = await visitor.get(`/api/v1/profiles/${traderSlug}/reputation`);
  check("public reputation endpoint is read-only cached", rep.status === 200 && rep.body?.source === "ethos", JSON.stringify(rep.body).slice(0, 160));

  const ext = await visitor.get(`/api/v1/extension/context?handle=${traderSlug}`);
  check("extension context resolves the Trader", ext.status === 200 && ext.body?.found === true, JSON.stringify(ext.body).slice(0, 200));
  check("extension context exposes no prices or PnL", !JSON.stringify(ext.body).includes("markPrice") && !JSON.stringify(ext.body).includes("realizedPnl"));

  // --------------------------------------------------------------- taker
  console.log("\nTaker journey");
  const taker = new Session();
  await taker.post("/api/v1/auth/session", { displayName: "Smoke Taker" });
  await taker.post("/api/v1/profiles", {
    slug: `taker${Date.now().toString(36).slice(-6)}`,
    displayName: "Smoke Taker",
  });
  const takerAccount = await taker.post("/api/v1/me/trading-accounts", {
    accountAddress: "0x2222222222222222222222222222222222222222",
  });
  const takerAccountId = takerAccount.body?.id;
  check("taker links own Hyperliquid account", takerAccount.status === 200 && Boolean(takerAccountId), JSON.stringify(takerAccount.body));

  const preview = await taker.post(`/api/v1/passes/${passId}/execution-preview`, {
    passVersion: 2,
    accountId: takerAccountId,
    positionSize: "250",
    leverage: "5",
    slippageToleranceBps: 50,
  });
  check("execution preview builds", preview.status === 200, JSON.stringify(preview.body).slice(0, 240));
  check("preview pins the reviewed Pass version", preview.body?.passVersion === 2);
  check("preview always requires confirmation", preview.body?.requiresConfirmation === true);

  const stale = await taker.post(`/api/v1/passes/${passId}/execution-preview`, {
    passVersion: 1,
    accountId: takerAccountId,
    positionSize: "250",
    slippageToleranceBps: 50,
  });
  check("stale version is refused (no silent stale execution)", stale.status === 409 && stale.body?.error?.code === "PASS_VERSION_STALE", JSON.stringify(stale.body));

  const foreign = await taker.post(`/api/v1/passes/${passId}/executions`, {
    passVersion: 2,
    accountId: traderAccountId,
    clientRequestId: `req_foreign_${Date.now()}`,
    signedPayload: { exchangeRequest: {}, signature: {} },
  });
  check("taker cannot execute with the Trader's account", foreign.status === 403 && foreign.body?.error?.code === "FORBIDDEN", JSON.stringify(foreign.body));

  const clientRequestId = `req_smoke_${Date.now().toString(36)}`;
  const signed = {
    exchangeRequest: {
      type: "order",
      action: { type: "buy", coin: "BTC", isCross: true, sz: "250", limitPx: "113400" },
      nonce: Date.now(),
      timestamp: Date.now(),
    },
    signature: { r: `0x${"1".repeat(64)}`, s: `0x${"2".repeat(64)}`, v: 27 },
  };

  const relay = await taker.post(`/api/v1/passes/${passId}/executions`, {
    passVersion: 2,
    accountId: takerAccountId,
    clientRequestId,
    signedPayload: signed,
  });
  check(
    "execution relays and returns {executionId, providerOrderId, status}",
    relay.status === 201 && Boolean(relay.body?.executionId) && Boolean(relay.body?.providerOrderId),
    JSON.stringify(relay.body),
  );
  const executionId = relay.body?.executionId;

  const dupe = await taker.post(`/api/v1/passes/${passId}/executions`, {
    passVersion: 2,
    accountId: takerAccountId,
    clientRequestId,
    signedPayload: signed,
  });
  check(
    "duplicate clientRequestId returns the same execution, never a second order",
    dupe.body?.executionId === executionId && dupe.body?.providerOrderId === relay.body?.providerOrderId,
    JSON.stringify(dupe.body),
  );

  const execRec = await taker.get(`/api/v1/executions/${executionId}`);
  check("execution status readable", execRec.status === 200 && execRec.body?.passVersion === 2, JSON.stringify(execRec.body).slice(0, 220));

  const myExec = await taker.get("/api/v1/me/executions");
  check("execution listed in my executions", (myExec.body?.executions?.length ?? 0) >= 1);

  const pubExec = await visitor.get(`/api/v1/passes/${publicId}/executions`);
  check("Pass shows its own verified takers", (pubExec.body?.executions?.length ?? 0) >= 1, JSON.stringify(pubExec.body).slice(0, 200));

  const pubAfter = await visitor.get(`/api/v1/passes/${publicId}`);
  check("PASS performance recorded against the Pass", (pubAfter.body?.performance?.takersCount ?? 0) >= 1, JSON.stringify(pubAfter.body?.performance));

  // ---------------------------------------------------------------- auth
  console.log("\nAuthorization boundaries");
  const noAuth = new Session();
  const denied = await noAuth.get("/api/v1/me");
  check("unauthenticated /me returns AUTH_REQUIRED", denied.status === 401 && denied.body?.error?.code === "AUTH_REQUIRED", JSON.stringify(denied.body));

  const other = new Session();
  await other.post("/api/v1/auth/session", { displayName: "Other" });
  await other.post("/api/v1/profiles", { slug: `other${Date.now().toString(36).slice(-6)}`, displayName: "Other" });
  const steal = await other.patch(`/api/v1/passes/${passId}`, { version: 2, thesis: "hijacked" });
  check("non-owner cannot edit a Pass", steal.status === 403 && steal.body?.error?.code === "FORBIDDEN", JSON.stringify(steal.body));

  const missing = await visitor.get("/api/v1/passes/does-not-exist");
  check("unknown Pass returns PASS_NOT_FOUND", missing.status === 404 && missing.body?.error?.code === "PASS_NOT_FOUND", JSON.stringify(missing.body));

  const badOrder = await visitor.get("/api/v1/passes/x");
  check(
    "error envelope matches docs/API_CONTRACTS.md §1",
    Boolean(badOrder.body?.error?.code && badOrder.body?.error?.message && badOrder.body?.requestId),
    JSON.stringify(badOrder.body),
  );

  // ------------------------------------------------------------- results
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f.name}${f.detail ? `: ${String(f.detail).slice(0, 200)}` : ""}`);
  }
  console.log("=".repeat(60));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});