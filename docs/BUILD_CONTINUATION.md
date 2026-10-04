# PASS — One-Shot Build Continuation

**Created:** 2026-10-03
**Reason:** stopped at a clean stage boundary with context exhausted. Deployment is blocked on operator authentication, not on code.

---

## Status

| Stage | State |
|---|---|
| A — Repository and foundation | **Complete**, gate passed |
| B — Identity | **Complete**, gate passed |
| C — Pass domain | **Complete**, gate passed |
| D — Public experience | **Complete**, gate passed |
| E — Hyperliquid read integration | **Complete**, gate passed |
| F — Hyperliquid execution | **Complete (mock mode)**, gate passed in mock. Live client signing is a recorded gap |
| G — Performance and lifecycle | **Complete**, gate passed |
| H — X distribution | **Partial** — OAuth flow and share metadata implemented; the share endpoint itself is not yet wired |
| I — Chrome extension | **Complete**, artifact builds |
| J — Deployment | **Blocked** — awaiting operator auth |

**Last commit:** see `git log -1` on `main`. The tree is clean.

---

## What is verified working

- `pnpm run check` is green: lint, typecheck across all 10 packages, 38 unit tests.
- `node scripts/smoke.mjs` reports **43 passed, 0 failed** against a running API. It walks the `docs/AI_HANDOFF.md` definition of done over HTTP only and is idempotent across runs.
- `pnpm --filter @pass/web build` produces a working production bundle for all 10 routes.
- `pnpm --filter @pass/extension build` produces a loadable MV3 artifact in `apps/extension/dist`.
- Secret scan of the web build output: **0 leaks**.

---

## Blocked: Stage J deployment — PARTIAL, precise state as of 2026-10-04

Both deploy CLIs are now authenticated (`railway` as `turntt`, `vercel` as `onyebuchidaniel60-1034`), so the original auth blocker is cleared. Two new blockers were found.

### What exists

| Resource | Identifier |
|---|---|
| Railway project `pass` | `10716e18-6be9-4e6a-89c9-839d754c5ea1` |
| Railway environment | `34426eb7-fb2d-4cad-b8af-b8c029dd467c` |
| Railway service `Postgres` | `422f243b-6f03-40ae-b3fb-2d056a6a9b6b` |
| Railway service `pass-api` | `85fe062b-041f-423d-97b1-677d21fca99e` |
| API public URL | `https://pass-api-production.up.railway.app` (assigned, **not serving yet**) |

API variables are set: `SESSION_SECRET`, `ENCRYPTION_KEY`, `LOG_LEVEL`, `HYPERLIQUID_MODE=mock`, `ETHOS_MODE=mock`, `X_MODE=mock`, `HYPERLIQUID_INFO_URL`, `HYPERLIQUID_EXCHANGE_URL`, `APP_URL`, `CORS_ORIGINS`.

### Blocker 1 — worker service cannot be provisioned

```
Free plan resource provision limit exceeded. Please upgrade to provision more resources!
```

The account's Railway free-plan allowance is already consumed by an unrelated existing project (`handsome-encouragement`, which contains `takeover-api` and two Postgres instances). PASS must **not** be deployed into that project, and the operator's other resources must not be deleted unilaterally.

**Operator action:** upgrade the Railway plan, or delete/pause the unused resources in `handsome-encouragement`, then run:

```bash
railway add -s pass-worker
railway up --service pass-worker
```

### Blocker 2 — API build runs the wrong command

Railway's Railpack auto-detects the root `package.json` and runs `pnpm run build`, which compiles the Next.js web app. That fails on Railway because the web build needs the Vercel toolchain, so the API never starts and `/health` returns 404.

`railway.toml` sets `buildCommand = "pnpm install --frozen-lockfile"`, but Railway reported the file as deprecated and **did not honour it**.

**Operator action** (either works):

```bash
# Option A — set it on the service
railway service settings        # Build -> "pnpm install --frozen-lockfile"

# Option B — migrate to Infrastructure as Code
railway config migrate
```

### Remaining Stage J steps once both blockers are cleared

```bash
# API
railway up --service pass-api
curl -s https://pass-api-production.up.railway.app/health     # expect 200

# Worker
railway up --service pass-worker

# Vercel
vercel --prod
vercel env add NEXT_PUBLIC_API_URL production     # https://pass-api-production.up.railway.app
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_ENV production
vercel --prod

# Update the API's CORS to the real Vercel domain, then redeploy the API
railway variables set --service pass-api CORS_ORIGINS=<vercel-domain>
railway up --service pass-api

# Production smoke test
SMOKE_API_URL=https://pass-api-production.up.railway.app node scripts/smoke.mjs
SMOKE_API_URL=https://pass-api-production.up.railway.app node scripts/smoke-approve-agent.mjs
```

---

## Remaining work, in order

1. **Stage J** — deploy and smoke test (blocked on the commands above).
2. **Stage H completion** — add `POST /api/v1/sharing/x` and wire the Share control on the Pass page. `ShareRequest`/`ShareResponseDto` and the X adapter's `createPost` already exist; the route and UI are missing. Copy-only sharing must keep working when native posting is unavailable.
3. **Live signing** — see `docs/INTEGRATION_VERIFICATION.md` §17.1. Add `hyperliquid` + `viem` and implement `signExchangeRequest`.
4. **`approveAgent`** — §17.2. Needs an injected wallet connector; operator decision on which wallets PASS supports.
5. **Stage K** — frontend design track, after the deployment is inspectable (D-017).

---

## Local development

```bash
pnpm install
pnpm --filter @pass/db migrate     # embedded PGlite; no Docker needed
pnpm dev:api                        # :4000
pnpm dev:web                        # :3000
node scripts/smoke.mjs
```

No credentials are required for any of the above. Every provider adapter defaults to mock mode.

---

## Defects found and fixed during this build

Recorded because they were real, not cosmetic:

1. Fastify rejected an empty JSON body on action endpoints (`/publish`, `/cancel`). Fixed with a tolerant content-type parser.
2. The execution **preview** did not enforce the stale-version check, so a Taker could reach the authorization step on a superseded Pass (D-018.3 step 3, `docs/UX_SPEC.md` §9). Fixed; the preview now returns `PASS_VERSION_STALE`.
3. The production web build failed to prerender `/settings` because `useSearchParams()` had no Suspense boundary. Fixed.
4. The smoke test reused fixed addresses, so it failed on a second run against the same database. Fixed — it is now idempotent.