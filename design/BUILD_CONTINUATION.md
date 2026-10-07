# Stage K — build continuation

**Written:** 2026-10-06 (tenth revision)
**Deadline mode.** Screens first; primitives built only when a screen pulls them.

## Current SHA

See `git log --oneline -1`. Pushed to `main`. Tree clean.

| SHA | Commit |
|---|---|
| `5f3a5ab` | `feat(design): take pass flow` |
| `3d9448d` | `feat(design): create pass screen` |
| `755f378` | `feat(design): stale pass route and error screens` |
| `260cfe8` | `feat(design): pass Open Graph metadata` |
| `cc56936` | phase record |

## Complete

| Item | Tests |
|---|---|
| Wave 0 foundation · corrections · harness · motion | 15 |
| Wave 1 (13) · Wave 2 (14) | 74 |
| Wave 3/4 primitives (16) · Wave 5 Dialog + interstitial | 34 |
| Gallery | 18 |
| Screens: Landing, Discover, Pass detail, Trader profile, Take flow, Create Pass, Stale, 404/error, OG | 106 |
| **Total** | **290** (245 web, 45 package) |

lint ✅ · typecheck ✅ · tokens ✅ · contrast ✅ · fonts ✅

## Screens done: 10 of 13 (§10.1–§10.7, §10.10–§10.12, §10.14)

## Exact next step — three screens left

1. **§10.8 My Passes (dashboard).** Build on demand: `DataTable`, `StatRow`.
   `GET /api/v1/me/passes`. Lifecycle summary strip of `StatBlock`s, Pass table
   with status chips, `Create a Pass` accent in the section header. Draft and
   cancelled rows take a ghost treatment, never reduced opacity (§10.8).
2. **§10.9 Executions.** Build on demand: `PriceCell`, `PnlCell`, `DataCell`,
   `Tag`, `Address`, `Timestamp`. `GET /api/v1/me/executions`. Row detail reveals
   the provider order id and the referenced Pass version (PRD §15). The period
   control is a `SegmentedControl` stored as an **offset from now**, never a
   frozen date (§10.9, skill §9 rule 2).
3. **§10.11 Onboarding and connect.** One step per screen. Progress as mono
   `STEP 2 / 4`. Provider-unavailable steps use `UnavailableBlock`.

Then: §10.13 extension overlay harmonisation (visual only — read token values,
inline them in `apps/extension/src/content.css` with a comment citing the source;
touch no detection, injection, SPA, API, or message-protocol logic), then
Tailwind removal in Wave 7.

## Still on provisional UI at the deadline

**Three screens:** §10.8 My Passes · §10.9 Executions · §10.11 Onboarding

**Primitives they need — build when you get there, never in advance:**
- My Passes: `DataTable`, `StatRow`
- Executions: `PriceCell`, `PnlCell`, `DataCell`, `Tag`, `Address`, `Timestamp`
- Onboarding: `UnavailableBlock` (exists), `PermissionBlock` (exists)
- Then §10.13 extension overlay, and Wave 5 remainder: `BottomSheet`, `Popover`,
  `Tooltip`, `Toast`, `Sidebar`, `BottomNav` (**must export their dimensions as
  tokens**)

## Operator verification checklist

1. Open `/`, `/discover`, `/p/UvvuxpWPZ4`, `/u/turnttfup99`,
   `/passes/UvvuxpWPZ4/take`, `/passes/new`, `/passes/UvvuxpWPZ4/stale` — all
   client-fetched, so served HTML shows only a loading state.
2. `/passes/new` should show the authorization block when signed out, and the
   form when signed in.
3. The Take flow must start with an EMPTY size field and refuse to advance
   until consent is ticked.
4. Font paint: nine `document.fonts.check(...)` calls; Network → `fonts` nine
   `/fonts/*.woff2` all 200; **zoom 200% on a heading — a serif means a face did
   not resolve**.
5. Target sizes ≥44px (declared, never measured) · press state `scale(0.98)` ·
   focus ring in forced-colors.
6. Above the fold at 375×812 on Pass detail and the Take flow: asset+direction,
   status, entry/TP/SL, CTA.
7. Reduced motion — nothing moves; signal line final-state.
8. Share a `/p/{publicId}` link on X and check the card reads
   `PASS / BTC LONG / @trader / Entry • TP • SL`.

## Standing constraints

- No browser automation. Nothing is visually verified. Phase stays open.
- No UI framework, component library, or animation library. Testing tools only.
- Tailwind until Wave 7. Ten screens are off it; the last three are not.
- **Build a primitive only when the screen in front of you needs it.** This rule
  held for four sessions running and is why no speculative primitive work exists.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
- Keep `PENDING_MIGRATION` current; the ratchet fails on too many or too few.
