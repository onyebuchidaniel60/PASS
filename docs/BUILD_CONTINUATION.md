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

## Blocked: Stage J deployment

Neither deploy CLI is authenticated in this environment:

```text
railway whoami  -> Unauthorized. Please login with `railway login`
vercel whoami   -> Logged out.
```

There is also no `DATABASE_URL` and no Docker/local `psql`.

### Exact next commands for the operator

```bash
# 1. Authenticate (interactive, browser-based)
railway login
vercel  login

# 2. Create the Railway Postgres + two services from this repo
railway init
railway add --database postgres
# service 1 -> API    : start command  pnpm --filter @pass/api start
# service 2 -> worker : start command  pnpm --filter @pass/worker start

# 3. Required non-provider variables (see docs/CREDENTIALS_SWAP.md)
railway variables set SESSION_SECRET=<32+ chars> ENCRYPTION_KEY=<32+ chars> \
  APP_URL=<web-url> CORS_ORIGINS=<web-url> LOG_LEVEL=info --service <api-service>
# DATABASE_URL is injected automatically by Railway Postgres.

# 4. Deploy API and worker
railway up --service <api-service>
railway up --service <worker-service>

# 5. Deploy web to Vercel from the repo root
vercel --prod            # vercel.json already sets the build command and output dir

# 6. Set web env vars, then redeploy
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_APP_URL production
vercel env add NEXT_PUBLIC_ENV production
vercel --prod

# 7. Smoke test the deployment
SMOKE_API_URL=https://<api-domain> node scripts/smoke.mjs
curl -s https://<api-domain>/health
```

`vercel.json` and `railway.toml` are already committed. Migrations run automatically on API and worker start.

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