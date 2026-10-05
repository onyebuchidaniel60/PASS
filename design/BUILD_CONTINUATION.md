# Stage K — build continuation

**Written:** 2026-10-06
**Reason:** context limit reached at a clean wave boundary. Everything below is
committed and pushed. No screen is half-built.

## Current SHA

`ebfe349` — `feat(design): token layer` (Wave 0)

Pushed to `main`. Working tree clean.

## Complete

| Wave | Status | Commit |
|---|---|---|
| **Wave 0 — Foundation** | **Built, not visually verified.** One gate item unmet. | `ebfe349` |

Wave 0 delivered:

- `apps/web/src/styles/tokens.css` — the single token layer, every token
  traceable to a clause of `design/DESIGN.md` §2–§8. Closes gap G-14.
- Self-hosted `@font-face` for Archivo (500/600/700), Inter Tight
  (400/500/600), IBM Plex Mono (400/500/600). Nine latin woff2 files committed
  to `apps/web/public/fonts/`. No runtime CDN.
- Reduced motion implemented by overriding the duration tokens under
  `prefers-reduced-motion`, so every future helper honours it for free.
- `apps/web/src/app/globals.css` rewritten on tokens, fixing a
  `color-scheme: light` base on a dark-only product.
- `scripts/check-design-tokens.mjs` — wired into `pnpm run check`, **proven to
  fail** on a planted violation (5 planted, 4 caught, 2 rules added to close the
  blind spot the plant exposed, then clean at exit 0).
- `scripts/check-contrast.mjs` — wired into `pnpm run check`. Nine of ten
  required pairings pass; one escalated as G-15.
- `design/phase-records/` — index, `PHASE_00_tokens.md`, `findings/deferred.md`.
- `design/README.md` — completion status table for all 8 waves and all 13
  screens.

## Not reached

Waves 1 through 7. No component and no screen has been built.

## In progress

Nothing. Wave 0 was closed out as far as the tooling permits and the next wave
was not started, so there is no partial state to reconcile.

## Blocked — needs the operator, not more tokens

1. **Font loading is unverified.** Wave 0's gate requires verifying the three
   families load **by rendered pixels**, not by a resolved family string
   (`design/DESIGN.md` §3.1; `SKILL_FRONTEND_DESIGN.md` §12 Phase 3 — the
   known defect where a family name with no matching face falls the whole type
   system back to a system serif and *no test fails*). This is the single most
   important thing to check before Wave 1 builds on the type system. Checklist
   in `design/phase-records/PHASE_00_tokens.md` §1 and §8.3.

2. **G-15 needs a design decision.** `design/DESIGN.md` §5.3 mandates
   `1px solid var(--color-line-strong)` as the input border; measured **1.37:1**
   against `--color-surface`, failing the 3:1 non-text minimum in plan §4.4.
   No replacement colour was invented. Wave 2 builds every form control, so this
   blocks visible work.

3. **G-16 needs a scope confirmation.** The Stage K brief lists 11 screens and
   splits "Dashboard" from "My Passes". `design/DESIGN.md` §10.8 defines **one**
   "My Passes (dashboard)" screen, `docs/UX_SPEC.md` §3 names four nav
   destinations with no Dashboard, and the build has no `/me` route. The brief
   also omits §10.7 (Stale Pass interstitial), §10.11 (Onboarding), §10.12
   (Error and not-found), and §10.14 (Open Graph), all of which the plan's
   Wave 7 requires. Wave 7 needs this answered; it is 13 screens, not 11, if
   the design document governs.

## Exact next step

Start **Wave 1 — signature devices and framing**.

1. Re-read `design/DESIGN.md` §9.1, §9.2, §5, §6 and
   `design/FRONTEND_IMPLEMENTATION_PLAN.md` §3. This is required before each
   wave and is not optional.
2. Build the motion helper module at `apps/web/src/motion/` first: durations and
   easings live in tokens, animation *behaviour* lives in helpers, components
   call helpers. The token scan already rejects a direct animation-library
   import from a component.
3. Then the components, in the plan's order: `Stack`, `Inline`, `Section`,
   `Panel`, `ChamferPanel`, `Rule`, `GridField`, `Eyebrow`, `SectionNumber`,
   `SignalLine`, `Reticle`, `CoordinatePair`, `PageShell`.
4. Then the gallery route at `apps/web/src/app/(dev)/gallery/page.tsx`, gated
   out of production, with the gating **verified** both anonymously and signed
   in rather than assumed.

Wave 1's gate: gallery renders every variant at 375 / 768 / 1280 / 1440;
`SignalLine` reveals once and is then still, and never animates on an inner
panel; at most three chamfered panels per built screen; no shadow elevation
outside the overlay tier; reduced motion forced on renders `SignalLine` in its
final state with no sweep.

## Standing constraints for the next session

- **No browser automation exists here.** Every screen will be "built, not
  visually verified" and each needs a manual checklist. Never write "verified"
  next to something not observed. Keep the phase open.
- Do not install a UI framework or an animation library.
- Do not edit `design/DESIGN.md`, `SKILL_FRONTEND_DESIGN.md`,
  `docs/DECISIONS.md`, or `docs/SECURITY_SPEC.md`.
- Do not change product behaviour or API contracts. Touch `apps/api` only if a
  design change requires a read-side field.
- For the extension overlay: visual harmonisation only. Detection, injection,
  and API logic are out of scope.
- One commit per wave, one per screen.
