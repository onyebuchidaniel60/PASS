# Stage K — build continuation

**Written:** 2026-10-06 (third revision — Wave 1 session)
**Reason:** context limit. Wave 1's **components** are complete, tested, and
pushed. The **gallery is not built**, so Wave 1's gate is **not cleared**.

## Current SHA

`8f37312` — `feat(design): wave 1 — signature devices and framing`

Pushed to `main`. Working tree clean.

| SHA | Commit | Content |
|---|---|---|
| `47a2664` | `test(web): add DOM test harness` | Task 1 |
| `518b5a6` | `feat(design): motion helpers` | Task 2 |
| `8f37312` | `feat(design): wave 1 — signature devices and framing` | Task 3 |

## Complete

| Unit | Status | Tests |
|---|---|---|
| Wave 0 — Foundation | Built, not visually verified. Fonts structurally verified; paint gate open. | — |
| Corrections (G-15, G-16, errata) | Closed | — |
| Web DOM test harness | Complete | 3 |
| Motion helpers | Complete | 12 |
| Wave 1 components (13) | Built, **gate not cleared** | 44 |

`pnpm run check`: **104 tests green** (45 package + 59 web), token scan PASS,
contrast PASS, fonts PASS.

## Wave 1 component inventory

`apps/web/src/components/wave1/layout.tsx`

| Component | § | Test status |
|---|---|---|
| `Stack` | §9.1 | 3 tests — renders, gap maps to a token, defaults to a token |
| `Inline` | §9.1 | 3 tests — renders, wraps by default, opt-out |
| `Section` | §9.1 | 2 tests — landmark only when named |
| `Panel` | §9.1 | 2 tests — renders, no inline style |
| `ChamferPanel` | §5.2, §9.1 | 4 tests — renders, accent edge off by default, opt-in, `aria-label` |
| `Rule` | §5.3 | 2 tests — hidden when meaningless, exposed when labelled |
| `GridField` | §8.2, §9.1 | 2 tests — 12 columns, aria-hidden |
| `PageShell` | §8.4 | 3 tests — one `main`, nav space off by default, opt-in |
| `ShellContent` | §8.2 | 1 test — renders |

`apps/web/src/components/wave1/signature.tsx`

| Component | § | Test status |
|---|---|---|
| `Eyebrow` | §9.2 | 4 tests — renders, delimiters on by default, opt-out, section number |
| `SectionNumber` | §9.2 | 3 tests — zero-pad, two-digit, string |
| `SignalLine` | §9.2 | 5 tests — renders, no reveal by default, reveal opt-in, `hr` hidden not wrapper, reticle node |
| `Reticle` | §7.1–§7.3 | 3 tests — accessible name required, label required to compile, inherits `currentColor` |
| `CoordinatePair` | §9.2, §11.2–§11.3 | 5 tests — label/value, no re-rounding, no tone variant, full value for a11y, both sizes |
| `CoordinateGrid` | §11.3 | 1 test — renders children |

Styles in `apps/web/src/styles/components.css`. Tokens only; three border
tokens were added to the token layer because that file was writing
`1px solid <colour>` directly and the scan correctly rejected it.

## Two defects the tests caught

Both were real and both would have shipped from a source read.

1. **`Section` was never a landmark.** HTML-AAM gives `<section>` the `region`
   role only when it has an accessible name; an unnamed section is generic and
   invisible to landmark navigation. Fixed: optional `label` → `aria-label`. The
   test now asserts named-is-a-region and unnamed-is-not, rather than assuming.

2. **`SignalLine` hid its own reticle.** The wrapper had `aria-hidden` to keep
   the decorative rule out of the accessibility tree — but §10.1 puts a `reticle`
   node on the hero signal line, and §7.3 requires every glyph to have an
   accessible name. Hiding the wrapper hid that name with it. `aria-hidden` now
   sits on the `<hr>` alone. A test asserts the wrapper is **not** hidden.

## Two scanner bugs found and fixed, both re-proved

| Bug | Consequence | Fix |
|---|---|---|
| Block-comment state not tracked across lines | A continuation line mentioning `0ms` inside `/* */` was scanned as code — false positive, and a false negative for any real violation following a block comment | Track `/* … */` state per file |
| `inline-style-object` rejected every style object | Flagged `gap: var(--space-7)`, which is the **required** token form | Reject only style objects whose values are not token references |
| `px-literal` flagged media-query breakpoints | `min-width: 1024px` is a documented §8.1 breakpoint and **cannot** be a token — CSS custom properties are invalid in media query conditions | Exclude breakpoint conditions; the four values are recorded beside `--layout-*` |

After relaxing the rules, the original plant was re-run: **all four violations
reported, exit 1**; removing it returned exit 0. A relaxed rule that no longer
fails is worthless.

## Not reached

- **Task 4 — the gallery route.** Not started.
- Wave 2, Wave 3, and everything after.
- No screen.

## Exact next step

**Build the gallery route**, then close Wave 1's gate.

1. Re-read `design/DESIGN.md` §9, §10.15, §5, §6 and
   `design/FRONTEND_IMPLEMENTATION_PLAN.md` §3 Wave 1's gate. Required.
2. `apps/web/src/app/(dev)/gallery/page.tsx`, rendering **every variant of every
   Wave 1 component** at 375 / 768 / 1280 / 1440, plus the §10.15
   narrow-width stress section: long values, wrapping rows, long labels,
   extreme numbers.
3. **Gate the gallery out of production, and verify the gating both anonymously
   and signed in.** Not assumed — `SKILL_FRONTEND_DESIGN.md` §12 Phase 4 records
   that an ungated dev route is how a gallery leaks into a shipped build.
4. Wave 1's gate, all five items:
   - every variant renders at 375 / 768 / 1280 / 1440;
   - `SignalLine` reveals once and is then still, and does not animate on any
     inner panel (asserted mechanically already: `signalLineReveal` is the only
     spec on `--duration-deliberate`);
   - at most three chamfered panels per built screen; chamfer size comes from
     `--chamfer-size`;
   - no shadow elevation outside the overlay tier (asserted: `--shadow-overlay`
     is absent from `components.css`);
   - reduced motion forced on: `SignalLine` renders final-state with no sweep.
5. Only then start **Wave 2** — actions and form controls: `Button`, `IconButton`,
   `LinkButton`, `SegmentedControl`, `Field`, `TextInput`, `NumericInput`,
   `Textarea`, `Select`, `LeverageStepper`, `ExpiryControl`, `Checkbox`,
   `Toggle`, `ValidationMessage`.

Wave 2's gate is where `--color-line-strong` finally becomes visible, so note the
amended value `#656577` is already in place and asserted at 3.33:1.

## Standing constraints

- **No browser automation here.** Everything is "built, not visually verified".
  Never write "verified" next to something not observed. Keep the phase open.
- No UI framework. No component library. No animation library. Testing tools
  only — the DOM harness is authorised and installed.
- Tailwind stays until Wave 7. `@tailwind` directives are still in `globals.css`
  and the Wave 7 screens are still utility-class based.
- The extension overlay is **not touched**; Wave 6.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`, or
  `docs/SECURITY_SPEC.md`. `design/DESIGN.md` only as a logged amendment — four
  exist, all recorded in `design/README.md`.
- One commit per wave, one per screen.
- **Keep `PENDING_MIGRATION` in `scripts/check-design-tokens.mjs` current.** Seven
  out-of-token values remain in four not-yet-rebuilt Wave 7 screens. Remove an
  entry as its screen is rebuilt; the ratchet fails on both too many and too
  few.

## Still open on the operator — the font paint check

**`pnpm run check:fonts` proves the files are correct. It does not prove they
paint.** A face can be valid, correctly named, correctly weighted, and
byte-identical to Google Fonts while the browser still declines to apply it, and
that failure is visible only as rendered pixels. It is also the failure where the
whole type system silently falls back to a system serif and **no test fails**.

1. `pnpm --filter @pass/web dev`, open the site.
2. DevTools Console — run all nine, expect `true` for each:

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

3. Network tab filtered to `fonts` — expect nine requests to
   `/fonts/*.woff2`, **every one 200**, none from a third-party origin.
4. **Zoom to 200% on a heading.** A **serif** there means a face did not resolve
   and the entire type system fell back. This is the defect the gate exists for.
5. Repeat on the deployed URL, not only localhost.
