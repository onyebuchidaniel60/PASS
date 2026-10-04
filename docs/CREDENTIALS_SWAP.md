# PASS — Credential Swap Runbook

Every provider adapter selects mock or live **by environment variable alone**. No code change and no rebuild is required to move a provider between modes.

- Default mode: `mock`.
- When a mode is `live` but credentials are missing, the adapter falls back to `mock` and logs **one** clear warning at startup.
- In `NODE_ENV=production`, a mode set to `live` without credentials **fails startup loudly**. Mock mode is never silently promoted to production (D-018.9).

---

## Live deployment

| Surface | URL |
|---|---|
| Web (Vercel production) | `https://pass-web-dun.vercel.app` |
| API (Railway production) | `https://pass-api-production.up.railway.app` |
| API health | `https://pass-api-production.up.railway.app/health` |
| Database | Railway Postgres, service `422f243b-6f03-40ae-b3fb-2d056a6a9b6b` |
| Railway project `pass` | `10716e18-6be9-4e6a-89c9-839d754c5ea1` |
| Railway service `pass-api` | `85fe062b-041f-423d-97b1-677d21fca99e` |
| Vercel project | `pass-web` (`prj_WOKd7QJHDyRWTdRyCGtRL36lkbjj`) |

The scheduled jobs run **in-process on the API** (`ENABLE_JOBS=true`) per `docs/DECISIONS.md` D-020. There is no separate worker service.

All three providers are currently in **mock** mode.

### Verify a deployment

```bash
curl -s https://pass-api-production.up.railway.app/health
curl -I https://pass-web-dun.vercel.app

# Full golden path against production (43 API checks + 8 web checks)
$env:SMOKE_WEB_URL="https://pass-web-dun.vercel.app"
$env:SMOKE_API_URL="https://pass-api-production.up.railway.app"
node scripts/smoke.mjs
node scripts/smoke-approve-agent.mjs
```

### Redeploy after any variable change

```bash
# API / worker variables
railway variables set --service pass-api KEY=value
railway up --service pass-api

# Web variables are inlined at build time, so the web must be rebuilt
vercel env add VAR_NAME production --value "value" --yes
vercel --prod
```

Migrations run automatically on API start, so a redeploy applies any schema change.

---

## Never do this

- **Never set `HYPERLIQUID_API_KEY`, an agent private key, a seed phrase, or a master key.** No such variable exists in this codebase and none may be added. The backend relays already-signed payloads and holds no signing material (D-018.3, D-018.9).
- Never place a secret under a `NEXT_PUBLIC_*` variable.
- Never commit `.env` files. Use host-managed secret storage.

---

## Hyperliquid

| Item | Value |
|---|---|
| Required env vars | `HYPERLIQUID_INFO_URL`, `HYPERLIQUID_EXCHANGE_URL` |
| Mode flag | `HYPERLIQUID_MODE=live` |
| Where | API and worker services |
| Obtain | Public endpoints from the official docs — no account needed |

Current documented values:

```text
HYPERLIQUID_INFO_URL=https://api.hyperliquid.xyz/info
HYPERLIQUID_EXCHANGE_URL=https://api.hyperliquid.xyz/exchange
```

These are **read-only URLs**. Hyperliquid needs no API key for Info API reads or for relaying a client-signed action.

**Swap step**

```bash
railway variables set --service pass-api \
  HYPERLIQUID_MODE=live \
  "HYPERLIQUID_INFO_URL=https://api.hyperliquid.xyz/info" \
  "HYPERLIQUID_EXCHANGE_URL=https://api.hyperliquid.xyz/exchange"
railway up --service pass-api
```

**Verify:** `curl $API_URL/health` shows `modes.hyperliquid = "live"`. No warning about a missing credential appears in the logs.

**What changes when live:** market metadata, mids, order books, account state, open orders, fills, and order status are read from the real Info API instead of fixtures. The relay path is unchanged.

**Still not live even after this swap — see the gap below.**

---

## Ethos

| Item | Value |
|---|---|
| Required env var | `ETHOS_API_BASE_URL` |
| Mode flag | `ETHOS_MODE=live` |
| Where | API and worker |
| Obtain | Ethos states its API is public and uses request headers, not an API key |

**Swap step**

```bash
railway variables set --service pass-api \
  ETHOS_MODE=live \
  ETHOS_API_BASE_URL=<base-url>
railway up --service pass-api
```

**Verify:** `GET /api/v1/integrations/ethos/refresh` returns a `providerProfileId`, and the public profile shows a credibility score with the non-verdict disclaimer.

**What changes when live:** reputation snapshots come from Ethos instead of the deterministic fixture. Caching, the read-only public surface, and the "not an absolute verdict" framing are unchanged.

---

## X

| Item | Value |
|---|---|
| Required env vars | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI` |
| Mode flag | `X_MODE=live` |
| Where | API |
| Obtain | Create an app in the X developer portal with OAuth 2.0 + PKCE. Enable the scopes `tweet.read tweet.write users.read offline.access` |

Set `X_REDIRECT_URI` to `https://pass-api-production.up.railway.app/api/v1/auth/x/callback`.

**Swap step**

```bash
railway variables set --service pass-api \
  X_MODE=live \
  X_CLIENT_ID=<id> \
  X_CLIENT_SECRET=<secret> \
  X_REDIRECT_URI=https://pass-api-production.up.railway.app/api/v1/auth/x/callback
railway up --service pass-api
```

**Verify:** `GET /api/v1/auth/x/start` returns `{"mode":"live","url":"https://twitter.com/i/oauth2/authorize?..."}`. Completing the flow stores an encrypted token and redirects to `/settings?x=connected`.

**What changes when live:** real OAuth with state and PKCE, native post creation, and real X profile resolution. Copy-only sharing keeps working unchanged and is never blocked by posting availability (Stage H gate).

---

## Database, session, encryption

These are not provider adapters but are required for any real deployment.

```bash
railway variables set \
  DATABASE_URL=<postgres-url> \
  SESSION_SECRET=<32+ random chars> \
  ENCRYPTION_KEY=<32+ random chars> \
  APP_URL=https://<web-domain> \
  CORS_ORIGINS=https://<web-domain> \
  LOG_LEVEL=info \
  --service pass-api
```

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Migrations run automatically on API and worker start, so a redeploy is all that is required after a schema change.

---

## Web (Vercel)

```text
NEXT_PUBLIC_APP_URL=https://<web-domain>
NEXT_PUBLIC_API_URL=https://<api-domain>
NEXT_PUBLIC_ENV=production
```

Redeploy after changing any of these; they are inlined at build time.

---

## Verification after any swap

```bash
curl -s https://pass-api-production.up.railway.app/health | jq .modes
node scripts/smoke.mjs
SMOKE_API_URL=https://pass-api-production.up.railway.app node scripts/smoke.mjs
```

`modes` must show the provider you just switched as `live`. The smoke test must still report `43 passed, 0 failed` — it is provider-agnostic and exercises both modes.

---

## Recorded gaps

### Live client-side signing is not wired

`apps/web/src/lib/signer.ts` produces a correctly shaped signed envelope in mock mode and **refuses** in live mode rather than sending an unsigned or fake-signed order for real funds.

To close it:

```bash
pnpm --filter @pass/web add hyperliquid@^1.7.7 viem@^2.57.2
```

Both are published and current. Then implement `signExchangeRequest` in `apps/web/src/lib/signer.ts` using the official SDK's documented signing path (AGENTS.md forbids hand-rolling the serialization). Signing stays in the browser; only the signed payload is submitted.

### `approveAgent` needs a browser wallet connector

Approving a generated agent address requires a signature from the Trader's master wallet. That needs an injected-wallet connector, which is not installed. Mock mode links an account address and skips approval.

No connector has been installed, and adding one is a product-visible choice, so it is left to the operator.

### Trader profiles use `/u/{slug}`

Public Trader profiles are served at `/u/{slug}` per `docs/DECISIONS.md` D-019.3. Next.js App Router reserves a leading `@` for parallel route segments, so the earlier at-prefixed convenience shape is not routable in the web app. The canonical immutable Pass URL `/p/{publicId}` is unaffected and remains the authoritative share target.