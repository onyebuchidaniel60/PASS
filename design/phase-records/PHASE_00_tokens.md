# Stage K — Wave 0: Foundation

## 1. Capability record (required before the first component)

Recorded per `design/FRONTEND_IMPLEMENTATION_PLAN.md` §0.1 and
`SKILL_FRONTEND_DESIGN.md` §13.4.

1. **Does the agent have browser automation? NO.**
2. **Device target:** none. PASS has no native mobile app in the MVP (PRD §5).
   The device surface is the Chrome extension loaded unpacked in a real Chrome
   profile, which the agent cannot drive.
3. **Where the capability lives:** nowhere in this environment. Available tools
   are a shell, a file reader, and a URL fetcher that returns HTML/markdown and
   executes no JavaScript.

**Consequence — operating mode is `SKILL_FRONTEND_DESIGN.md` §7.6 and plan
§6.7, from day one, not an exception discovered late:**

- Every screen this track produces is marked **"built, not visually verified"**.
- No screen may be described as matching `design/DESIGN.md`, because it has not
  been opened.
- Each screen ships with a manual verification checklist for the operator.
- **This phase stays open until the operator returns results.**

What the URL fetcher can and cannot do: it can confirm a deployed route
returns HTTP 200 and inspect server-rendered markup. It cannot execute
JavaScript, take a screenshot, measure a box, compute rendered contrast, click,
or read a console. It is therefore a reachability probe, **not** visual
verification, and is never recorded as such.

---

## 2. Header

- **Phase:** Wave 0 — Foundation
- **Stage:** K
- **Date:** 2026-10-06
- **Author:** coding agent, per `AGENTS.md`

## 3. Scope

**Delivered:**

- The single token layer at `apps/web/src/styles/tokens.css`, containing every
  colour, type step, spacing value, radius, duration, easing, and layout
  dimension specified in `design/DESIGN.md` §2–§8.
- Self-hosted `@font-face` for all three families, each listed weight loaded as
  its own face.
- A rewritten `globals.css` base layer consuming tokens only.
- `scripts/check-design-tokens.mjs`, wired into `pnpm run check`.
- `scripts/check-contrast.mjs`, wired into `pnpm run check`.
- `scripts/fetch-web-fonts.mjs`, the one-time font fetcher.
- A `prefers-reduced-motion` implementation that overrides the duration tokens
  themselves, so every future helper honours it without re-checking.

**Deliberately not delivered in this wave:**

- No components. Wave 0 is tokens, fonts, reset, and base styles only.
- No screens.
- No motion helper module (`apps/web/src/motion/`) — it belongs to Wave 1, the
  first wave that has something to animate.
- No gallery route (`apps/web/src/app/(dev)/gallery/page.tsx`). It is Wave 1's
  verification surface and would render nothing until Wave 1 lands.
- **Tailwind was not removed.** It is a `devDependency` and the Wave 7 screens
  are written in utility classes. Removing it before the screens are rebuilt
  would break every one of them. New components use tokens, not utilities, and
  the token scan enforces that. Tailwind removal is a Wave 7 completion
  criterion and is recorded there, not silently forgotten here.

## 4. Design document read

`design/DESIGN.md`, `design/FRONTEND_IMPLEMENTATION_PLAN.md`,
`SKILL_FRONTEND_DESIGN.md`, `design/references/SOURCES.md`,
`docs/UX_SPEC.md`, `docs/PRODUCT_PRD.md` §7–§8, `docs/DECISIONS.md` D-017 and
D-019, and `docs/SECURITY_SPEC.md` §2 were all read in full before any token
was written, per plan §1. Re-read again before writing the scanner and the
foundation CSS.

## 5. Commit and deploy

- **Commit:** see §15.
- **Deploy URL:** **none. This wave was not deployed.** No component or screen
  changed rendering, only the base layer the not-yet-rebuilt screens sit on, so
  there was nothing to verify visually and deploying would have produced a
  misleading "verified" signal. Deployment is a gate at the end of the first
  screen wave (§8 of the plan's Wave 7 loop).

## 6. Token-check proof — planted violation

`design/FRONTEND_IMPLEMENTATION_PLAN.md` §2.3: *"A scan that has never failed is
not known to work."* Both outcomes are recorded here.

**What was planted.** `apps/web/src/components/_PlantedViolation.tsx`, a
throwaway component carrying five deliberate violations:

```tsx
style={{
  color: "#7d5fff",            // raw hex
  padding: 13,                 // unitless = 13px, invisible to a px regex
  borderRadius: 7,             // unitless = 7px, invisible to a px regex
  transitionDuration: "350ms", // raw duration
  fontFamily: "Comic Sans MS", // camelCase font literal
}}
```

**Failing output** (`pnpm run check:tokens`, exit code **1**):

```
VIOLATION  apps/web/src/components/_PlantedViolation.tsx:10  [hex-literal] DESIGN.md §2.1
      raw hex colour literal: #7d5fff
VIOLATION  apps/web/src/components/_PlantedViolation.tsx:13  [duration-literal] DESIGN.md §6.2
      raw ms/s duration literal: 350ms
VIOLATION  apps/web/src/components/_PlantedViolation.tsx:14  [font-family-literal-js] DESIGN.md §3.1
      font-family literal in a React style object (use a token class): fontFamily:
VIOLATION  apps/web/src/components/_PlantedViolation.tsx:9  [inline-style-object] FRONTEND_IMPLEMENTATION_PLAN.md §2.2
      React inline style object; use a token-backed class instead: style={{
result: 4 untolerated violation(s), 0 ratchet error(s). FAIL.
```

**The first plant only caught 2 of 5.** `padding: 13` and `borderRadius: 7`
passed silently, because a unitless number in a React style object is a px
value that neither the hex rule nor the `px` regex can see, and
`fontFamily:` is camelCase so the CSS `font-family:` rule missed it. Rather
than ship a scan with a known blind spot, two rules were added:
`font-family-literal-js`, and `inline-style-object`, which rejects React inline
style objects in component files outright — that is the only channel through
which a length can enter without appearing as a literal.

**Clean re-run after removing the plant** (exit code **0**):

```
result: every remaining value is a recorded Wave 7 migration, not a new violation. PASS.
```

**Ratchet integrity, also proven.** The remaining 7 violations sit in four
screens that Wave 7 has not rebuilt yet. Tolerating them by directory exclusion
would have been a silent blind spot, so they are allowed per file with an
**exact** expected count. Tightening one allowance from 2 to 1 was confirmed to
fail:

```
RATCHET ERRORS:
result: 2 untolerated violation(s), 1 ratchet error(s). FAIL.
```

A file that gains a violation fails, and a file that drops below its allowance
also fails with *"Delete the stale entry"*. The allowance cannot rot.

## 7. Screenshots

**None.** No browser capability (§1). Every exclusion from a measurement in
this phase is listed in §8.

## 8. Measurements

### 8.1 Contrast, computed programmatically

`scripts/check-contrast.mjs` implements WCAG 2.1 relative luminance and the
ratio formula and runs over the literal token values, so it cannot be misled by
rendering. Minimums from plan §4.4.

| Pairing | Measured | Min | Result |
|---|---|---|---|
| `--color-text-primary` on `--color-canvas` | **17.59:1** | 4.5 | PASS |
| `--color-text-secondary` on `--color-canvas` | **8.99:1** | 4.5 | PASS |
| `--color-text-tertiary` on `--color-canvas` | **5.40:1** | 4.5 | PASS |
| `--color-text-on-accent` on `--color-accent` | **5.02:1** | 4.5 | PASS |
| `--color-accent-text` on `--color-canvas` | **6.22:1** | 4.5 | PASS |
| `--color-data-positive` on `--color-canvas` | **8.65:1** | 4.5 | PASS |
| `--color-data-negative` on `--color-canvas` | **5.32:1** | 4.5 | PASS |
| `--color-accent` on `--color-canvas` (focus ring) | **5.02:1** | 3 | PASS |
| `--color-line-strong` on `--color-surface` (input border) | **1.37:1** | 3 | **FAIL — G-15** |
| `--color-text-disabled` on `--color-canvas` | **2.80:1** | 4.5 | residual, see §11 |
| `--color-line-hairline` on `--color-surface` | **1.16:1** | — | measured, not asserted |

**Documented-versus-measured discrepancies.** `design/DESIGN.md` §2.4 states
ratios that do not exactly match computation. None changes a verdict, and the
design document was **not** edited to match:

| Token | Doc states | Measured | Note |
|---|---|---|---|
| `--color-text-secondary` | 8.9:1 | 8.99:1 | rounding |
| `--color-text-disabled` | 2.6:1 | 2.80:1 | rounding |
| `--color-text-on-accent` on accent | 5.6:1 | **5.02:1** | doc overstates by 0.58; still passes 4.5 |
| `--color-accent-text` | 5.9:1 | 6.22:1 | doc understates |
| `--color-data-positive` | 8.7:1 | 8.65:1 | rounding |

### 8.2 Measurement exclusions, recorded

- `--color-line-hairline` on `--color-surface` is **measured but not asserted**
  against the 3:1 non-text minimum. It is a decorative panel divider and row
  rule, which WCAG 1.4.11 exempts. Asserting a standard that does not apply
  would be a false failure. Recorded here so the exclusion is explicit rather
  than silent, per plan §4.3.

### 8.3 Not measured in this wave

- **Minimum target size.** No component exists yet. Wave 2 measures every
  interactive element.
- **Horizontal overflow.** No screen was rendered.
- **Above-the-fold field positions.** No screen exists.
- **Font loading verified by rendered pixels.** `design/DESIGN.md` §3.1 and
  Wave 0's gate require this. **Still not done** — it needs a browser.

### 8.4 Font verification — added 2026-10-06 (`efe6b48`)

`scripts/check-fonts.mjs` now verifies everything short of rendering, and is
wired into `pnpm run check` as `check:fonts`.

Verified programmatically:

- All nine latin woff2 faces exist, are non-zero, and carry the `wOF2`
  signature, so a truncated or empty file cannot pass silently.
- All nine `@font-face` blocks resolve to existing files; family and weight
  agree with the filename, which is where a quoting or camelCase mismatch
  causes the silent fallback described in `SKILL_FRONTEND_DESIGN.md` §12
  Phase 3.
- No face uses `font-display: block`; all nine use `swap`, so text is never
  hidden on a slow load.
- **Provenance:** each committed file's SHA-256 equals a freshly fetched Google
  Fonts latin woff2 for that same family **and that same weight**. All nine are
  byte-identical. This is why no woff2 decoder was added as a dependency:
  byte-identity with the upstream file for a given weight is a stronger claim
  than a parsed `OS/2.usWeightClass`, because it also rules out a truncated or
  substituted file.

No fix was needed.

The check was proved to fail before its clean result was trusted: declaring
weight `650` for the three 600 faces produced three named failures and exit 1,
and reverting returned exit 0.

**Still unverified, and it is the whole point:** that the faces **paint**. A
file can be valid, correctly named, correctly weighted, and byte-identical to
upstream while the browser still declines to apply it, and that is only visible
as rendered pixels. The script says so on every run.

### 8.5 Operator font checklist (required — Wave 0's gate is open until returned)

1. `pnpm --filter @pass/web dev`, open the site.
2. DevTools Console — run all nine, expect `true` for each:

```js
document.fonts.check('500 16px Archivo')        // true
document.fonts.check('600 16px Archivo')        // true
document.fonts.check('700 16px Archivo')        // true
document.fonts.check('400 16px "Inter Tight"')  // true
document.fonts.check('500 16px "Inter Tight"')  // true
document.fonts.check('600 16px "Inter Tight"')  // true
document.fonts.check('400 16px "IBM Plex Mono"') // true
document.fonts.check('500 16px "IBM Plex Mono"') // true
document.fonts.check('600 16px "IBM Plex Mono"') // true
```

3. Network tab filtered to `fonts` — expect nine requests to
   `/fonts/*.woff2`, every one **200**, none from a third-party origin.
4. **Zoom to 200% on a heading.** If it renders in a **serif**, a face did not
   resolve and the entire type system fell back. This is the known defect in
   `SKILL_FRONTEND_DESIGN.md` §12 Phase 3 and **no test fails** when it
   happens.
5. Repeat on a deployed URL, not only localhost.

Report each of the nine results, the request count, and pass/fail on step 4.


## 9. Findings

| # | Observed | Reproduced by | Category | Disposition |
|---|---|---|---|---|
| 1 | `globals.css` declared `color-scheme: light` with `#ffffff` background and `#171717` text, on a product `design/DESIGN.md` §2.7 specifies as dark-only with `#0A0A0A` canvas and `#F5F1EA` text | Reading the pre-existing file | `design-violation` | **Fixed this phase.** Base layer rewritten on tokens. |
| 2 | `--color-line-strong` as the input border measures 1.37:1 | `node scripts/check-contrast.mjs` | `accessibility` | **Escalated as G-15**, §11. Not fixed; the value is design-mandated. |
| 3 | 13 out-of-token values across 5 files | `node scripts/check-design-tokens.mjs` on first run | `anti-pattern` | 6 fixed this phase in `globals.css`; 7 ratcheted to their Wave 7 screen rebuild with exact counts. |
| 4 | Executions wraps its table in `overflow-x-auto` with `min-w-[720px]` | Reading `apps/web/src/app/me/executions/page.tsx:49-50` | `design-violation` | **Deferred to Wave 7** — `design/DESIGN.md` §8.5 forbids a horizontal scroller for wide tables and requires a stacked-card list below the tablet breakpoint. Not fixed here because the fix is the screen rebuild, not a token. |
| 5 | No `/me` dashboard route exists; the build produces `/me/executions` and `/me/passes` only | `pnpm --filter @pass/web build` route table | `blocks-loop` | **Not yet resolved.** See §11 G-16. |

## 10. Acquittals

What was investigated and cleared, separated from what was found:

- **`design/DESIGN.md` §2.7 light-mode handling.** Checked whether the dark-only
  decision conflicts with the token layer's promise that light is "purely
  additive". It does not: every semantic token resolves to a primitive and no
  component references a primitive, which is the property §2.7 actually
  requires. Cleared — no change needed.
- **Contrast of the ember accent as a focus ring on canvas.** Suspected a
  borderline result; measured 5.02:1 against a 3:1 minimum. Cleared.
- **Data-positive and data-negative on canvas.** Both §2.6 pairings pass 4.5:1
  (8.65:1 and 5.32:1), so the price-data pair is usable for text without
  adjustment. Cleared.
- **Font family fallback risk.** Considered deferring font work because nine
  faces were fetched from a network at build-prep time. Fetched them, committed
  them, and confirmed the build succeeds, so there is no CDN dependency at
  runtime, which is what §3.1 forbids. What remains unverified is only whether
  the faces *paint*, which is recorded in §8.3.

## 11. Design-gap log

### G-15 (new, this wave) — input border fails the non-text contrast minimum

**CLOSED 2026-10-06 — `e5cd559`.** Resolved by amending the design document.

- **Screen:** any form. First hit at `apps/web/src/app/passes/new/page.tsx`.
- **What was needed:** an input and focused-container border that identifies the
  control.
- **What was missing:** `design/DESIGN.md` §5.3 mandated
  `1px solid var(--color-line-strong)` with the token specified as `#2C2C34` in
  the §2.3 table. Measured **1.37:1** against `--color-surface`, failing the
  **3:1** non-text minimum in plan §4.4. A 1px line at that ratio does not
  identify a control.
- **What was NOT done at the time:** no replacement colour was chosen.
  `design/DESIGN.md` specified no alternative, and inventing one would fill a
  specification hole with improvised visual language (§13.2 step 1).
- **Resolution:** no value in the §2.3 line ramp reached 3:1; the darkest
  existing value that did was a text token at 5.18:1, which would make every
  input border read as body text. `#2C2C34` was therefore scaled uniformly by
  2.29, preserving its blue tint, to **`#656577`** — measured 3.33:1 on
  `--color-surface`, 3.47:1 on `--color-canvas`, 3.51:1 on
  `--color-surface-sunken`, 3.16:1 on `--color-surface-raised`. §2.3 and §5.3
  were amended and §5.3.1 added with the full derivation. The value is now
  asserted by `scripts/check-contrast.mjs`, so reverting it fails the build.

### G-16 (new, this wave) — "Dashboard" has no route

**CLOSED 2026-10-06 — `2c13b67`.** Resolved by deriving the list from §10.

- **Scope:** the Stage K screen inventory.
- **Observed:** the Stage K brief listed 11 screens and included both
  "Dashboard" and "My Passes" as separate items. `design/DESIGN.md` §10.8
  defines **one** screen, "My Passes (dashboard)". The brief also omitted
  §10.7 Stale Pass interstitial, §10.11 Onboarding and connect, §10.12 Error and
  not-found, and §10.14 Social preview. `docs/UX_SPEC.md` §3 names four global
  destinations — `Discover · My Passes · Executions · Profile` — with no
  Dashboard, and the build has no `/me` route.
- **What was NOT done:** no dashboard route was invented. Adding a destination
  to global navigation that neither the UX spec nor the design document
  specifies would be a product-behaviour change, which Stage K forbids.
- **Resolution:** 13 web screens, taken from §10 and independently corroborated
  by the plan's Wave 7 list, plus §10.13 extension surfaces (Wave 6) and §10.15
  Gallery (Wave 1). Recorded in `design/README.md` and
  `design/BUILD_CONTINUATION.md`. `design/DESIGN.md` was **not** edited — it was
  already correct; the defect was in the derived list.

### Existing gaps that bind this wave

- **G-2 — no wordmark.** `design/DESIGN.md` §7.3 and §12.2 forbid a custom logo
  until G-2 closes. The landing hero must therefore ship with the `PASS` name
  set as type only, and no favicon may be improvised.
- **G-1 — light mode.** Dark-only. No light values were derived by inversion.
- **G-14 — token layer path.** Closed by this phase: the single token layer is
  `apps/web/src/styles/tokens.css`, matching the plan's provisional path.

## 12. Design amendments

Three, all recorded here as separately logged acts, never as side effects of
coding (`SKILL_FRONTEND_DESIGN.md` §4, `design/DESIGN.md` §13.2 step 3).

### A1 — G-15, `--color-line-strong` (§5.3, §5.3.1, §2.3) — `e5cd559`

**Reason.** §5.3 mandated a value that failed the 3:1 non-text minimum in plan
§4.4, measured at 1.37:1. No value in the line ramp reached 3:1, so one had to
be derived: `#2C2C34` scaled uniformly by 2.29 to `#656577`, measured 3.33:1 on
`--color-surface` and 3.16–3.51:1 on the other three surfaces an input can sit
on. Amendment text, derivation, and the four measurements are in §5.3.1. The
value is asserted by `scripts/check-contrast.mjs`, so a regression fails.

### A2 — §2.9 Errata (measured) — `d352554`

**Reason.** Five contrast figures quoted in §2.4, §2.5, and §2.6 did not match
computation. The **original stated values were preserved** and the measured
values recorded alongside them, because correcting the document to agree with an
implementation destroys the record that it was ever wrong. No entry changed a
pass/fail verdict, so none was escalated to a gap. Committed separately from
A1 so the two change types stay distinguishable in history.

### A3 — G-14, token layer path — closed, no amendment needed — `ebfe349`

§13.1 listed the token layer path as unowned. Wave 0 bound it to
`apps/web/src/styles/tokens.css`, matching the plan's provisional path. This
closed the gap by resolving it; `design/DESIGN.md` §13.1 was not edited.

**Not amended:** the discrepancies between §2.4's stated ratios and measurement
were handled as errata (A2), not by editing §2.4. `design/DESIGN.md` §7.3, §8,
§9, §10, and §12 were not touched in any session.

## 13. Rejected alternatives

| Choice | Rejected | Why |
|---|---|---|
| Where to put the token layer | `globals.css` alongside the base rules | `design/DESIGN.md` gap G-14 names the token layer as a distinct single source. Mixing tokens and reset in one file makes "no value outside the token layer" unverifiable. |
| `@font-face` location | A separate `fonts.css` | It would be a second file defining font literals, weakening the claim of exactly one token layer. All three families are declared in `tokens.css`. |
| Tolerating the 7 pre-existing violations | Excluding the four screen directories | A directory exclusion is a silent blind spot. The per-file exact-count ratchet fails on both more and fewer violations. |
| Fixing the 7 pre-existing violations now | Rewriting 7 lines in 4 screens | Three of them map cleanly onto existing tokens, but the fourth is `min-w-[720px]` inside `overflow-x-auto`, which DESIGN.md §8.5 forbids outright. Fixing that one properly means building the stacked-card list, which is the Executions screen rebuild. Doing one line of each screen now would be a partial screen change, which plan §7.5 forbids. |
| Adding a token for the 720px table width | A new `--layout-*` token | It would legitimise the horizontal-scroller anti-pattern with a named token. The anti-pattern is the finding; the token would launder it. |
| Selecting a replacement input border for G-15 | Any new colour value | Design-mandated value failing a standard is reported and escalated, never silently corrected (`SKILL_FRONTEND_DESIGN.md` §9 rule 9). |
| Reduced motion via a helper-level check | Overriding the duration tokens in `tokens.css` under `prefers-reduced-motion` | One switch, read in one place, honoured by every helper, and no component can forget it. DESIGN.md §6.6 asks for exactly this behaviour. |

## 14. Consistency readings

**None performed.** Plan §6.2 step 10 requires reading any two screens that show
the same quantity for the same period side by side. No screens have been
rebuilt yet, so the pairs named in the plan — Pass performance vs Trader
performance, a Pass's PnL vs the corresponding Executions row, counts on
Discover vs counts on My Passes — cannot yet be compared. This is a Wave 7
requirement and is carried forward.

## 15. Open items

- **The phase is OPEN.** Wave 0's gate requires font loading to be verified by
  **rendered pixels**, which needs a browser (§8.3). That gate is not cleared.
- **G-15** awaits a design decision on the input border.
- **G-16** awaits confirmation of the screen inventory.
- Tailwind removal is deferred to Wave 7.
- No screen has been built, deployed, or visually verified.

## 16. Next step

Wave 1 — signature devices and framing: `Stack`, `Inline`, `Section`, `Panel`,
`ChamferPanel`, `Rule`, `GridField`, `Eyebrow`, `SectionNumber`, `SignalLine`,
`Reticle`, `CoordinatePair`, `PageShell`, plus the motion helper module at
`apps/web/src/motion/`, plus the gallery route that renders every variant at
375 / 768 / 1280 / 1440. Re-read `design/DESIGN.md` §9.1, §9.2, §5, §6 and this
plan §3 before starting.
