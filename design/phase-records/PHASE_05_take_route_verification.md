# Stage K — Phase 05: take route and OG verification

Date 2026-10-06. Commit for this phase: the `fix(design): take route and OG
metadata` commit. Author: coding agent, per `AGENTS.md`.

## Capability

No browser automation. Everything is "built, not visually verified".

## What was verified from the DEPLOYED artifact

| Check | Result |
|---|---|
| `HEAD /passes/UvvuxpWPZ4/take` | **200** |
| Served HTML is the Take flow, not the 404 page | **`STEP 1 / 4`, `Choose your size`, `Position size`, `Review order` all present** |
| `og:title` | `PASS - Pass UvvuxpWPZ4` — **fallback, not spec** |
| `og:description` | `A trader-authored Hyperliquid trade plan. Inspect the trader, inspect the plan, take it with your own position size.` — **fallback, not spec** |
| `twitter:card` | `summary` |

## Root cause of the take-route 404

Two defects, both the same mistake:

1. The route imported `clientGet`, which lives in a `"use client"` module, into a
   **server component**. Calling a client-module function from the server does
   not perform a server-side fetch, so the fetch never happened and
   `notFound()` fired unconditionally. Every other route worked because it
   fetches in the browser.
2. `notFound()` fired on *any* fetch failure. An unreachable API therefore told
   the Taker their Pass did not exist. Now only a genuine API 404 is a 404;
   anything else renders an error state.

After fixing both, the route STILL returned 404. The cause was **a stale
Vercel build cache** — the CLI reported "Restored build cache from previous
deployment". Deploying with `--force` produced a clean build and the route
served correctly.

**Lesson worth keeping:** a green test suite and a correct-looking diff do not
prove what is deployed. Only reading the deployed artifact does. Two sessions
have now been lost to a build artefact rather than to code.

## Open item — OG metadata still serves the fallback

`generateMetadata` was switched to the server `apiGet` and the unit tests mock
the correct module, but the **served** `og:description` is still the generic
fallback text.

Unit tests pass, so the code path is exercised. The most likely remaining cause
is that `generateMetadata` is evaluated during the Vercel **build**, where
`NEXT_PUBLIC_API_URL` is inlined as `http://127.0.0.1:4000` — the local dev
fallback in `apps/web/src/lib/api.ts` — while the runtime environment has the
real URL. That would make the build-time fetch fail while the request-time route
works, which is exactly the pattern observed.

**Not fixed, and not claimed as fixed.** Recorded here and in the continuation
note. Next session should confirm whether `NEXT_PUBLIC_API_URL` is present in
the Vercel **build** environment, or whether `generateMetadata` should read a
server-only variable such as `PASS_API_URL`.

## Screens completed this phase

None. This session spent its budget on verification of the previously shipped
Take route and OG metadata rather than starting a new screen, because the Take
route — the core conversion surface — was broken in production and a half-built
screen is not a boundary.

## Design gaps

None. No `design/DESIGN.md` amendments.

## Measurements

**Not possible.** No browser automation. No target sizes, no overflow, no
above-the-fold assertions, no rendered contrast, no reduced-motion rendering.

## Status

**OPEN** — gated on the operator browser pass, and on the OG item above.
