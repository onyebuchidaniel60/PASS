# PASS — Development

## Prerequisites

- Node `>=22` (`engines` in `package.json`).
- pnpm `10.34.5` (`packageManager` in `package.json`).

## Local setup

```bash
git clone <repo-url>
cd PASS
pnpm install
pnpm --filter @pass/api dev      # API on :4000 (tsx watch src/server.ts)
pnpm --filter @pass/web dev      # web on :3000 (next dev -p 3000)
```

Without `DATABASE_URL` the API uses embedded Postgres (PGLite) for local
dev and tests.

## Environment

Names only — no values. API names come from `ApiEnvSchema`
(`packages/contracts/src/env.ts`); web names from `apps/web/src`.

| Variable | Used by |
|---|---|
| `NODE_ENV` | api |
| `LOG_LEVEL` | api |
| `DATABASE_URL` | api |
| `DATABASE_PGLITE_PATH` | api |
| `APP_URL` | api |
| `CORS_ORIGINS` | api |
| `SESSION_SECRET` | api |
| `ENCRYPTION_KEY` | api |
| `HYPERLIQUID_MODE` | api |
| `HYPERLIQUID_READS_MODE` | api |
| `HYPERLIQUID_INFO_URL` | api |
| `HYPERLIQUID_EXCHANGE_URL` | api |
| `ETHOS_MODE` | api |
| `ETHOS_API_BASE_URL` | api |
| `X_MODE` | api |
| `X_CLIENT_ID` | api |
| `X_CLIENT_SECRET` | api |
| `X_REDIRECT_URI` | api |
| `PORT` | api |
| `HOST` | api |
| `ENABLE_JOBS` | api |
| `SEED_DEMO_DATA` | api |
| `NEXT_PUBLIC_APP_URL` | web |
| `NEXT_PUBLIC_API_URL` | web |
| `NEXT_PUBLIC_ENV` | web |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | web |

## Database

Postgres on Supabase over the Transaction pooler (port `6543`), accessed
with postgres-js and `prepare: false`. Schema lives in `@pass/db` (Drizzle).

```bash
pnpm --filter @pass/db generate   # drizzle-kit generate
pnpm --filter @pass/db migrate    # tsx src/migrate-cli.ts
```

## Deploy

- Web: Vercel, auto-deploys on push to main. Alias pass-web-dun.vercel.app.
- API: Render, deploy from dashboard. Branch is main.
- DB: Supabase. Migrations via the migration script.
- Rollback: redeploy previous commit in Vercel and Render dashboards.

## Tests

```bash
pnpm test                        # vitest run && pnpm --filter @pass/web test
pnpm --filter @pass/web test     # web suite only (vitest run)
pnpm -r typecheck                 # typecheck every workspace
pnpm lint                        # eslint .
```

## Design assets

Reference images and screenshots under design/ are local-only and
gitignored. On a fresh clone, copy the design/ media from the operator's
working copy. The shot specs under apps/web/e2e/ regenerate the
verification screenshots locally.

## Agent tooling

Agent instruction files (AGENTS.md, .clinerules, SKILL_FRONTEND_DESIGN.md)
are machine-local and gitignored. Restore per docs/AI_HANDOFF.md §14. Not
part of the product.
