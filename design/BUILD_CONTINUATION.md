# Stage K — build continuation

**Written:** 2026-10-06 (sixth revision — Wave 2 complete, deployed)
**Deadline note:** time is short. Prioritise by visibility, not by wave number.

## Current SHA

`4de3df4` — `feat(design): wave 2 form and control primitives`

Pushed to `main`. Tree clean.

## Deployed

**https://pass-web-dun.vercel.app** — `/` → 200, `/gallery` → 404 (gate holds).

Deployed CSS verified live: `--chamfer-size`, `pass-btn`, `pass-segmented`,
`pass-validation`, `--color-accent`, `--size-target-min`.

| Layer | State on production |
|---|---|
| Token layer (Wave 0) | ✅ live |
| Fonts (Wave 0) | ✅ live, 200 |
| Dark-only base (Wave 0) | ✅ live |
| Wave 1 components | ✅ live (CSS + component library) |
| Wave 2 components | ✅ live (CSS + component library) |
| **All 13 screens** | ❌ **still Stage J provisional UI** |

**The component library is live but no screen consumes it yet.** Wave 7 is what
makes it visible. Anyone opening the site sees the old UI.

## Complete

| Wave | Components | Tests |
|---|---|---|
| 0 — Foundation | tokens, fonts, base, 3 checks | — |
| Corrections (G-15, G-16, errata) | — | — |
| DOM harness | — | 3 |
| Motion helpers | 10 specs | 12 |
| Wave 1 | 13 | 44 |
| Wave 2 | 14 | 30 |
| Gallery | — | 18 |
| **Total** | **27 components** | **152** (107 web + 45 package) |

lint ✅ · typecheck ✅ · token scan ✅ · contrast ✅ · fonts ✅

> `pnpm run check` as one chained command returns a harness timeout in this
> environment under load. Each stage passes when run alone. Not a test failure.

## Not reached

Waves 3, 4, 5, 6, 7. No screens. Extension overlay untouched.

## Next session — in this priority order

Time-boxed to the deadline, so do visibility first. A screen that renders is
worth more to a judge than a finished Wave 5 overlay primitive nobody sees.

1. **§10.1 Landing** — first thing every judge sees. Hero
   `See a trade. Know the trader. Take the trade.` at `--type-display-xl`,
   one `SignalLine` with a `reticle`, `Explore Passes` as the single
   accent-filled CTA and `Create a Pass` as ghost immediately after, the
   five-step `CoordinatePair` strip, support line at `--type-body-l`. All of
   Wave 1 + `Button` now exist. **Do this first.**
2. **§10.3 Pass detail** — the core object. `ChamferPanel` for the plan block,
   `CoordinatePair` grid for ENTRY/TP/SL/LEVERAGE, `StatusChip` (Wave 3),
   `Reticle` at the panel's top-left, `TAKE PASS` accent button. Needs Wave 3's
   `StatusChip` first — build just that primitive if context is tight.
3. **§10.4 Trader profile** — where the extension links. `PerformanceBlock` and
   `ReputationBlock` with a mandatory `Rule` between them (D-007 / PRD §12).
   Needs Wave 4.
4. Wave 3 data display, Wave 4 identity/state blocks, Wave 5 overlays, Wave 6
   extension surfaces, Wave 7 remaining screens + Tailwind removal.

Each screen needs: real pipeline data, empty/loading/error/success states, and a
test. Do not start a screen without context to finish its states.

## Operator checklist (unchanged, still open)

### Font paint check

```js
document.fonts.check('500 16px Archivo');        // true
document.fonts.check('600 16px Archivo');        // true
document.fonts.check('700 16px Archivo');        // true
document.fonts.check('400 16px "Inter Tight"');  // true
document.fonts.check('500 16px "Inter Tight"');  // true
document.fonts.check('600 16px "Inter Tight"');  // true
document.fonts.check('400 16px "IBM Plex Mono"'); // true
document.fonts.check('500 16px "IBM Plex Mono"'); // true
document.fonts.check('600 16px "IBM Plex Mono"'); // true
```

Run against production. Network → `fonts`: nine `/fonts/*.woff2`, all 200, no
third-party. **Zoom 200% on a heading — a serif means a face did not resolve.**

### Wave 2 gate items needing a browser

1. **Measured target sizes.** Every Wave 2 control declares
   `min-height: var(--size-target-min)` (44px), but nothing measured it — jsdom
   has no layout. Confirm on `/settings` or a form screen: buttons, icon
   buttons, segmented options, stepper buttons, checkbox and toggle rows all
   ≥44×44.
2. **Press state by computed style.** Click and read `transform` — expect
   `scale(0.98)` while active, none at rest.
3. **Focus ring in forced-colors.** Enable Windows high contrast and tab through
   a form.
4. **Wave 1 gate items 1 and 5** — the gallery at 375×812 and 1280×800, and the
   reduced-motion toggle producing a still signal line.

## Standing constraints

- No browser automation. Everything is "built, not visually verified".
- No UI framework, component library, or animation library. Testing tools only.
- Tailwind until Wave 7. **No screen consumes the new components yet** — that is
  the single largest gap between built and visible.
- Extension overlay untouched (Wave 6). Visual harmonisation only when reached.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
- Keep `PENDING_MIGRATION` current; the ratchet fails on too many or too few.
