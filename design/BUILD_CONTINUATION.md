# Stage K — build continuation

**Written:** 2026-10-06 (eighth revision — batch session)
**Deadline mode.** Screens first; wave order is subordinate to visibility.

## Current SHA

See `git log --oneline -1`. Pushed to `main`. Tree clean.

| SHA | Commit |
|---|---|
| `3605539` | `feat(design): status chip primitive` |
| `5a1ae5c` | `feat(design): pass detail screen` |
| `5abe6c7` | `feat(design): trader profile screen` |

## Complete

| Item | Tests |
|---|---|
| Wave 0 foundation · corrections · DOM harness · motion helpers | 15 |
| Wave 1 — 13 components | 44 |
| Wave 2 — 14 components | 30 |
| Wave 3/4 primitives — 15 components | 27 |
| Wave 5 — `Dialog` + stale interstitial | 7 |
| Gallery | 18 |
| §10.1 Landing | 18 |
| §10.3 Pass detail | 21 |
| §10.4 Trader profile | 13 |
| **Total** | **231** (186 web + 45 package) |

lint ✅ · typecheck ✅ · tokens ✅ · contrast ✅ · fonts ✅

## Screens done: 3 of 13. Landing, Pass detail, Trader profile.

## Exact next step

**1. Extract the presentational states from `PassDetailClient` into a pure view
component and close the one open test gap** — the network-failure → error-state
transition. Recorded in `design/phase-records/PHASE_02_batch_session.md`; it
resisted four mocking approaches and needs a refactor, not another tweak.

**2. §10.6 Take flow.** Needs `NumericInput` + `LeverageStepper` (exist) and the
`Dialog` (exists). Four steps: size → preview → authorize → confirmation. Must
feel like a document being signed, not a checkout. Taker's size is empty by
default and never pre-filled from the Trader's size (§10.6 Step 1, D-015).

**3. §10.2 Discover.** Check the API list route first — `/api/v1/passes?limit=2`
returns 404, so the discover route is something else. Grep
`apps/api/src/routes/public.ts` for it.

**4. Then** §10.5 Create Pass · §10.7 stale interstitial as a route · §10.8 My
Passes · §10.9 Executions · §10.10 Profile · §10.11 Onboarding · §10.12
Error/404 · §10.14 OG. Then §10.13 extension overlay harmonisation (visual only),
then Tailwind removal.

## Still on provisional UI at the deadline

**Screens not rebuilt — 10 of 13:**
- §10.2 Discover
- §10.5 Create Pass
- §10.6 Take flow (4 steps)
- §10.7 Stale Pass interstitial (component exists, no route)
- §10.8 My Passes (dashboard)
- §10.9 Executions
- §10.10 Profile and connections
- §10.11 Onboarding and connect
- §10.12 Error and not-found
- §10.14 Social preview / OG

**Primitives those screens still need — Wave 3/5 remainder:**
- `DataTable` (CSS exists), `PriceCell`, `DataCell`, `StatRow`, `Tag`
- `BottomSheet`, `Popover`, `Tooltip`, `Toast`
- `Sidebar`, `BottomNav` — must **export their dimensions as tokens**
- `Avatar`, `ConnectionChip`, `PermissionBlock`, `StaleBlock`
- §10.13 extension overlay still on the neutral on-X palette, not PASS's

## Operator verification checklist

1. **Font paint** — nine `document.fonts.check(...)` calls, Network → `fonts`
   nine `/fonts/*.woff2` all 200, **zoom 200% on a heading: a serif means a face
   did not resolve**.
2. **Target sizes** — every control declares `--size-target-min` (44px) but
   nothing measured it; jsdom has no layout.
3. **Press state** — click and read computed `transform` (expect `scale(0.98)`).
4. **Focus ring** in forced-colors.
5. **Above the fold** — on Pass detail and the Take flow, asset+direction,
   status, entry/TP/SL and the CTA must be in the first viewport at 375×812.
6. **Reduced motion** — no element moves; signal line final-state.
7. **Rendered contrast** — proven against token values, not pixels.
8. **Screens** — Landing, `/p/UvvuxpWPZ4`, `/u/turnttfup99` at 375×812 and
   1280×800.

## Standing constraints

- No browser automation. Nothing is visually verified. Phase stays open.
- No UI framework, component library, or animation library. Testing tools only.
- Tailwind until Wave 7. Landing, Pass detail, and Trader profile are off it;
  the other 10 screens are still utility-class based.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
- Keep `PENDING_MIGRATION` current; the ratchet fails on too many or too few.
