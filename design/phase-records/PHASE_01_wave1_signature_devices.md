# Stage K — Wave 1: signature devices and framing

Commit: `8f37312`. Date: 2026-10-06. Stage: K.

## 1. Scope

Delivered the thirteen Wave 1 components from `design/DESIGN.md` §9.1 and
§9.2, their token-backed stylesheet, the motion helper module, and the web DOM
test harness the component contract requires.

**Not delivered:** the gallery route. Wave 1's gate requires it, so **this wave
is not closed** and its gate is not cleared. See `design/BUILD_CONTINUATION.md`.

## 2. Design document read

`design/DESIGN.md` §9.1, §9.2, §5, §6, §7, §8, §10.15, §11, §12 and
`design/FRONTEND_IMPLEMENTATION_PLAN.md` §2.4, §3, §5 were re-read before this
wave, as §1 requires before each wave.

## 3. Findings

| # | Observed | Reproduced by | Category | Disposition |
|---|---|---|---|---|
| 1 | `Section` rendered `<section>` with no accessible name, so it was never a `region` landmark | Component test | `accessibility` | **Fixed.** Optional `label` → `aria-label` |
| 2 | `SignalLine`'s wrapper was `aria-hidden`, hiding the `reticle` node's accessible name with it | Component test | `accessibility` | **Fixed.** `aria-hidden` moved to the `<hr>` alone |
| 3 | `components.css` wrote `1px solid <colour>` directly, out of token | Token scan | `anti-pattern` | **Fixed.** Three border tokens added to the token layer |
| 4 | Token scan did not track block-comment state across lines | Token scan false positive on a comment containing `0ms` | `anti-pattern` | **Fixed.** State tracked per file |
| 5 | Token scan rejected `gap: var(--space-7)`, the required token form | Token scan false positive | `anti-pattern` | **Fixed.** Rule now rejects only non-token values |
| 6 | Token scan flagged media-query breakpoints | Token scan false positive on `min-width: 1024px` | `anti-pattern` | **Fixed.** Excluded; CSS custom properties are invalid in media query conditions |

## 4. Design-gap log

No new gaps. Three design-document rules were encoded rather than merely
obeyed, and each is asserted so it cannot rot:

- §11.3 price levels are equal in weight and never colour-coded, so
  `CoordinatePair` has **no** `tone` prop at all.
- §11.2 decimals follow the market convention supplied by the API, so
  `CoordinatePair` never re-rounds its value.
- gap G-13 limits the hero sweep, so `SignalLine` does not animate by default
  and `reveal` must be asked for.

## 5. Design amendments

**None.** `design/DESIGN.md` was not edited in this wave.

## 6. Token-check status

`pnpm run check:tokens` exit 0. Seven values remain in four not-yet-rebuilt
Wave 7 screens under `PENDING_MIGRATION` with exact per-file counts.

Because three rules were relaxed, the original plant was re-run: **all four
original violations reported, exit 1**; removing it returned exit 0. A relaxed
rule that no longer fails is worthless.

## 7. Measurements

**Not possible in this environment.** No browser automation, so none of §4.3 is
measurable: target sizes, horizontal overflow, above-the-fold positions, and
rendered contrast all require a rendered box. The gallery — Wave 1's own
verification surface — has not been built, so even the four-breakpoint render
cannot be checked.

Every claim in this wave is therefore about the DOM contract asserted in tests,
not about rendered appearance. Nothing here is visually verified.

## 8. Findings still open

- Wave 1's gate: gallery not built; gating not verified anonymously or signed in.
- Reduced-motion rendering of `SignalLine` unverified in a browser; the CSS
  path exists and the token override is asserted, but painted pixels are not.
- The font paint check remains open on the operator.

## 9. Status

**OPEN — gated on the gallery and on operator verification.**
