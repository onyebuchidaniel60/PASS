# Stage K — build continuation

**Written:** 2026-10-06 (second revision — corrections session)
**Reason:** context limit reached. Tasks 1–4 of the corrections session are
complete, committed, and pushed. Wave 1 was **not started**; nothing is
half-built.

## Current SHA

`d352554` — `docs(design): errata — measured contrast ratios`

Pushed to `main`. Working tree clean.

Session commits, in order:

| SHA | Commit | Content |
|---|---|---|
| `efe6b48` | `fix(design): verify fonts and add programmatic font check` | Tasks 1 |
| `e5cd559` | `docs(design): G-15 amendment — input border contrast` | Task 2 |
| `2c13b67` | `docs(design): G-16 — screen list derived from DESIGN.md §10` | Task 3 |
| `d352554` | `docs(design): errata — measured contrast ratios` | Task 4 |

## Operator resolutions applied

All four items from the previous session are closed.

| Item | Was | Now |
|---|---|---|
| Font loading | unverified | 9/9 faces verified byte-identical to Google Fonts per family **and weight**; `@font-face` cross-checked; `font-display: swap` confirmed; check proved to fail on a planted mismatch. **Paint is still unverified — needs a browser.** |
| G-15 | open, `--color-line-strong` at 1.37:1 | **Closed.** `DESIGN.md` §2.3 and §5.3 amended to `#656577` (3.33:1), derivation in §5.3.1, now asserted so a regression fails the build |
| G-16 | open, screen list disputed | **Closed.** 13 web screens derived from §10; brief's 11 superseded |
| Contrast errata | 5 mismatches undocumented | **`DESIGN.md` §2.9 added.** Original stated values preserved alongside measured |

## Complete

| Wave | Status | Commit |
|---|---|---|
| **Wave 0 — Foundation** | Built, not visually verified. Fonts structurally verified; font *paint* gate still open. | `ebfe349`, `efe6b48` |
| **Corrections session** | Tasks 1–4 complete | `efe6b48` … `d352554` |

## Not reached

Waves 1 through 7. No component and no screen has been built.

## Wave 1 — status: NOT STARTED, with one prerequisite found

Investigated before stopping, so the next session does not discover it
mid-wave.

### Blocker found: no DOM test environment exists

`design/FRONTEND_IMPLEMENTATION_PLAN.md` §2.4 requires every component to ship
with "a test". Wave 1's thirteen components are React components whose only
meaningful assertions are rendered output, accessible names, and computed
styles. None of that is assertable today:

- Root `vitest.config.ts` sets `include: ["packages/**/*.test.ts", "apps/api/**/*.test.ts"]`
  and `environment: "node"`. `apps/web/**` is **not** in the include list, so a
  web component test would not run at all.
- Confirmed absent everywhere (root and `apps/web/node_modules`): `jsdom`,
  `happy-dom`, `@testing-library/react`, `@vitejs/plugin-react`.

**What the next session must do first:** decide on and install a DOM test
environment for `apps/web`, then extend `vitest.config.ts` with a second
project covering `apps/web/**/*.test.tsx` under a DOM environment with JSX
transformed.

This is the one place where the "no new dependencies" constraint is in tension
with a stated requirement. The reasoning to record: a DOM environment is a
**verification tool**, which the constraint explicitly permits, and §2.4's
"and a test" is not optional. The alternative — writing Wave 1's thirteen
components with no tests — is a process anti-pattern in both
`SKILL_FRONTEND_DESIGN.md` §11 and the plan §7 ("Building a screen before its
components existed, and discovering mid-screen that a needed primitive had no
reduced-motion or empty-state behaviour").

If adding the harness proves difficult, the honest fallback is to record it as a
gap with a manual checklist, not to quietly skip the tests.

### Then, Wave 1 in the plan's order

1. Re-read `design/DESIGN.md` §9.1, §9.2, §5, §6 and
   `design/FRONTEND_IMPLEMENTATION_PLAN.md` §3. Required before each wave.
2. `apps/web/src/motion/` — durations and easings live in tokens; animation
   **behaviour** lives in helpers; components call helpers. Every helper must
   collapse to instant or fade-only under `prefers-reduced-motion`, and the
   switch is read in one place. The token scan already rejects a direct
   animation-library import from a component.
3. Components: `Stack`, `Inline`, `Section`, `Panel`, `ChamferPanel`, `Rule`,
   `GridField`, `Eyebrow`, `SectionNumber`, `SignalLine`, `Reticle`,
   `CoordinatePair`, `PageShell`.
4. Gallery route at `apps/web/src/app/(dev)/gallery/page.tsx`, rendering every
   variant at 375 / 768 / 1280 / 1440 plus the narrow-width stress section
   (§10.15), gated out of production with the gating **verified** both
   anonymously and signed in.

Wave 1's gate: gallery renders every variant at all four breakpoints;
`SignalLine` reveals once and is then still and never animates on an inner
panel; at most three chamfered panels per built screen; no shadow elevation
outside the overlay tier; reduced motion forced on renders `SignalLine` in its
final state with no sweep.

## The authoritative Stage K screen list (G-16, closed)

`design/DESIGN.md` §10 governs. 13 web screens in Wave 7, in the plan's order:

| # | Screen | §  | Wave |
|---|---|---|---|
| 1 | Landing | §10.1 | 7 |
| 2 | Discover / Explore Passes | §10.2 | 7 |
| 3 | Pass detail — the core conversion surface | §10.3 | 7 |
| 4 | Trader profile | §10.4 | 7 |
| 5 | Create Pass | §10.5 | 7 |
| 6 | Take flow, steps 1–4 | §10.6 | 7 |
| 7 | Stale Pass interstitial | §10.7 | 7 |
| 8 | My Passes (dashboard) | §10.8 | 7 |
| 9 | Executions | §10.9 | 7 |
| 10 | Profile and connections (own) | §10.10 | 7 |
| 11 | Onboarding and connect | §10.11 | 7 |
| 12 | Error and not-found | §10.12 | 7 |
| 13 | Social preview (Open Graph) | §10.14 | 7 |

Plus, outside Wave 7: §10.13 Extension surfaces (Wave 6) and §10.15 Gallery
(Wave 1).

**The brief's eleven-screen list is superseded.** It split "Dashboard" from
"My Passes" — §10.8 defines one "My Passes (dashboard)" screen, and there is no
`/me` route in the build — and it omitted §10.7, §10.11, §10.12, and §10.14.
`design/FRONTEND_IMPLEMENTATION_PLAN.md` §3 Wave 7 independently lists the same
13, so the plan and the design document agree and the brief was the outlier.

## Blocked on the operator

1. **Font paint.** `pnpm run check:fonts` proves the files are correct, not that
   they render. A face can be a valid, correctly-named, correctly-weighted file
   the browser still declines to apply. Checklist in
   `design/phase-records/PHASE_00_tokens.md` §8.3: nine
   `document.fonts.check(...)` calls, nine `/fonts/*.woff2` requests all 200,
   and zoom in on a heading — a serif there means a face did not resolve and the
   whole type system silently fell back, which no test catches.

## Standing constraints

- **No browser automation here.** Everything is "built, not visually verified".
  Never write "verified" next to something not observed. Keep the phase open.
- No UI framework. No animation library.
- Do not edit `SKILL_FRONTEND_DESIGN.md` or `docs/DECISIONS.md` or
  `docs/SECURITY_SPEC.md`. `design/DESIGN.md` may be amended only as a logged
  act with a stated reason — three have been made, all recorded in
  `design/README.md`: G-15 (§5.3.1), the §2.9 errata, and G-14's token-layer
  path.
- No product-behaviour or API changes. Touch `apps/api` only if a design change
  requires a read-side field.
- Extension overlay: visual harmonisation only. Detection, injection, and API
  logic are out of scope.
- One commit per wave, one per screen.
- `pnpm run check` currently green: 45/45 tests, token scan PASS, contrast PASS,
  fonts PASS.
