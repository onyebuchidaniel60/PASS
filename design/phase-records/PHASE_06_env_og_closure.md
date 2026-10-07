# Stage K — Phase 06: env verification and OG closure

Date 2026-10-06. Commit `4c94881`. Author: coding agent, per `AGENTS.md`.

## Task 1 result: CLOSED

**`vercel env ls production` showed all three variables PRESENT** for the
`uhhh2/pass-web` project:

| Variable | Type | Environments |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Config | Production |
| `NEXT_PUBLIC_ENV` | Config | Production |
| `NEXT_PUBLIC_API_URL` | Config | Production |

Nothing needed to be added. **My previous diagnosis was wrong.**

## What the actual cause was

1. `generateMetadata` imported `clientGet`, which lives in a `"use client"`
   module. Calling it from a server context performs no fetch, so it silently
   served the fallback.
2. My earlier verification was **premature**: I curled the deployed URL about 20
   seconds after the deploy command returned, before the new build was serving,
   and concluded the fix had failed. A second session of lost time came from
   verifying a deploy before the deploy finished.

Two sessions were attributed to deploy artefacts. One was a stale Vercel build
cache. The other was **me reading the previous deployment** and believing it.

## Verified from the deployed artifact

| Check | Result |
|---|---|
| `og:title` | `PASS - BTC LONG` |
| `og:description` | `BTC LONG · @turnttfup99 · Entry $113.4K • TP $116K • SL $111.9K` |
| `twitter:description` | same |
| `HEAD /passes/UvvuxpWPZ4/take` | 200 |
| `HEAD /` `/passes/new` `/me/passes` `/me/executions` `/settings` | 200 |
| `HEAD /gallery` | 404 (gate holds) |

The served card matches `design/DESIGN.md` §10.14's format, uses compact
figures (permitted in a headline context only), and exposes no private account
data.

## Hardening committed

`apps/web/src/lib/api.ts` now resolves the base URL through a function whose
localhost fallback is **development-only**. In production a missing
`NEXT_PUBLIC_API_URL` throws instead of silently resolving to `127.0.0.1`, which
is what made this class of failure quiet. Local development is unaffected.

## Screens completed this phase

**None.** The session was spent closing the two-session deploy investigation and
hardening it. With the remaining context a screen could have been started but not
finished, and a half-built screen is not a boundary.

## Screens still provisional — four

| Screen | § | Route | Primitives needed on demand |
|---|---|---|---|
| My Passes (dashboard) | §10.8 | `/me/passes` | `DataTable`, `StatRow` |
| Executions | §10.9 | `/me/executions` | `PriceCell`, `PnlCell`, `DataCell`, `Tag` |
| Profile and connections | §10.10 | `/settings` | `Avatar`, `ConnectionChip` |
| Onboarding and connect | §10.11 | none yet | none beyond Wave 2 |

All four routes currently serve the **provisional Stage J UI**. They return 200,
so a status check will not reveal that; each must be opened in a browser.

Then: §10.13 extension overlay harmonisation (visual only), then Tailwind removal
in Wave 7.

## Measurements

**Not possible.** No browser automation.

## Status

**OPEN** — gated on the operator browser pass and the four remaining screens.
