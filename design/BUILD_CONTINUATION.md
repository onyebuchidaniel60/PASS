# Stage K — build continuation

**Written:** 2026-10-06 (ninth revision — screens-first session)
**Deadline mode.** Screens first; primitives built only when a screen pulls them.

## Current SHA

See `git log --oneline -1`. Pushed to `main`. Tree clean.

## Complete

| Item | Tests |
|---|---|
| Wave 0 foundation · corrections · harness · motion | 15 |
| Wave 1 (13) · Wave 2 (14) | 74 |
| Wave 3/4 primitives (15) · Wave 5 Dialog + interstitial | 34 |
| Gallery | 18 |
| §10.1 Landing · §10.2 Discover · §10.3 Pass detail · §10.4 Trader profile | 62 |
| **Total** | **241** (196 web + 45 package) |

lint ✅ · typecheck ✅ · tokens ✅ · contrast ✅ · fonts ✅

## Exact next step

**1. Take flow (§10.6) — retry, with its 14 tests already drafted.**
`apps/web/src/app/passes/[publicId]/take/` is back on the provisional build and
`TakeFlowClient.tsx` + `takeFlow.test.tsx` were reverted. The real route exists:
`POST /api/v1/passes/:id/execution-preview` (auth-gated, in
`apps/api/src/routes/pass.ts`) then `POST /api/v1/passes/:id/executions`. A GET
to the preview route 404s because it is POST-only, which is what made it look
missing.

Three things to carry forward:
- `window.scrollTo` must be guarded; jsdom does not implement it and an
  unguarded call interrupts the step transition.
- The order summary restates the size **as typed**, not re-formatted.
- The four failures were formatting-expectation bugs in the tests, not product
  defects.

**2. §10.12 Error/404** — small: a `not-found.tsx` and an error boundary.
**3. §10.5 Create Pass** — reuse the provisional auth mechanism, do not build a
   new auth pattern. Needs no new primitives.
**4. §10.14 OG metadata** — verify `/p/{publicId}` OG tags match the spec format.
**5. §10.7 stale route** — the component exists; it only needs its own route.
**6. Then** §10.8 My Passes · §10.9 Executions · §10.10 Profile · §10.11
Onboarding. Then §10.13 extension overlay harmonisation (visual only), then
Tailwind removal in Wave 7.

## Still on provisional UI at the deadline

**Screens not rebuilt — 9 of 13:**
- §10.5 Create Pass
- §10.6 Take flow (4 steps) — **reverted this session, retry first**
- §10.7 Stale Pass interstitial (component exists, no route)
- §10.8 My Passes (dashboard)
- §10.9 Executions
- §10.10 Profile and connections
- §10.11 Onboarding and connect
- §10.12 Error and not-found
- §10.14 Social preview / OG

**Primitives those screens still need — build on demand, not in advance:**
- `DataTable` (CSS only), `PriceCell`, `DataCell`, `StatRow`, `Tag`
- `BottomSheet`, `Popover`, `Tooltip`, `Toast`
- `Sidebar`, `BottomNav` — must **export their dimensions as tokens**
- `Avatar`, `ConnectionChip`, `PermissionBlock`, `StaleBlock`
- §10.13 extension overlay still on the neutral on-X palette, not PASS's

## Operator verification checklist

1. Open `/`, `/discover`, `/p/UvvuxpWPZ4`, `/u/turnttfup99` in a browser — all
   four are client-fetched, so served HTML shows only a loading state.
2. Confirm `/u/turnttfup99` now lists the trader's Active Pass (it was broken
   by a wrong API URL until this session).
3. Font paint: nine `document.fonts.check(...)` calls; Network → `fonts` nine
   `/fonts/*.woff2` all 200; **zoom 200% on a heading — a serif means a face did
   not resolve**.
4. Target sizes ≥44px — declared in CSS, never measured.
5. Press state — computed `transform` should be `scale(0.98)` while active.
6. Focus ring in forced-colors.
7. Above the fold on Pass detail at 375×812: asset+direction, status, entry/TP/SL, CTA.
8. Reduced motion — nothing moves; signal line final-state.
9. Confirm the Rule sits between PASS Performance and Reputation on the profile.

## Standing constraints

- No browser automation. Nothing is visually verified. Phase stays open.
- No UI framework, component library, or animation library. Testing tools only.
- Tailwind until Wave 7. Landing, Discover, Pass detail, and Trader profile are
  off it; the other 9 screens are utility-class based.
- **Build a primitive only when the screen in front of you needs it.** This is
  the rule that changed the pace and it held this session.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
- Keep `PENDING_MIGRATION` current; the ratchet fails on too many or too few.
