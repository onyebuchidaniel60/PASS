# Stage K — build continuation

**Written:** 2026-10-06 (fourth revision — gallery session)
**Reason:** context limit. Gallery built and committed. **Not deployed.**

## Current SHA

`cb95ac0` — `feat(design): component gallery`

Pushed to `main`. Tree clean.

## ⚠ READ FIRST — the gallery is not fully gated. Do not deploy.

Two attempts, both insufficient. Evidence below. **No deploy was performed
this session, deliberately.**

1. Runtime `return null` when `NODE_ENV !== "development"`. Passed every unit
   test; **shipped anyway** — `/gallery` registered in
   `app-path-routes-manifest.json` and the gallery source present in two `.next`
   chunks.
2. Server component calling `notFound()`, UI moved to `gallery-client.tsx`.
   Correct for *serving* (404s in production) but **did not fix the leak** —
   route still in the manifest, source still in `page.js`. Next.js builds every
   route under `app/` regardless of what it renders.

### Exact next step for the gate

**Fix the leak before anything else.** Two viable approaches:

- **Production module alias** in `next.config.js`: when
  `process.env.NODE_ENV === "production"`, alias the gallery page module to a
  stub that calls `notFound()`. The real component is then never entered into
  the bundle, so it cannot appear in a chunk.
- **Move the route out of `app/`** and expose it in development only, e.g. a
  dev-only entry outside the App Router tree.

### Verification that must pass afterwards (both directions)

```bash
pnpm --filter @pass/web build
# 1. route gone from the build manifest
Select-String -Path apps/web/.next/app-path-routes-manifest.json -Pattern "gallery"
# 2. no gallery content in any chunk
Get-ChildItem -Recurse -Path apps/web/.next -Include *.js,*.html |
  Select-String -Pattern "narrow-width stress" -List
```

Both must return nothing. Then verify in **development** that it still works,
and confirm the signed-in and anonymous checks below.

## Gallery gating verification (Task 1 reporting)

| Check | Result |
|---|---|
| Anonymous, development | ✅ renders — 18 gallery tests |
| Production, anonymous | ⚠️ **route present in build manifest; source in `page.js`** |
| Signed in, production | ❌ **NOT verified** — needs a deployed build, and there is none |
| Signed in, development | ❌ **NOT verified** — no browser |

Only the unit-level gate logic is proven. Build-level gating is **not**.

## Wave 1 gate, item by item (Task 2 reporting)

| # | Gate item | Status |
|---|---|---|
| 1 | Gallery renders every variant at 375 / 768 / 1280 / 1440 | **Built, not visually verified.** Gallery exists and is asserted in jsdom; no viewport rendering was measured. → operator checklist |
| 2 | `SignalLine` reveals once, is then still, never animates on an inner panel | **Satisfied mechanically.** `signalLineReveal` is asserted to be the only spec on `--duration-deliberate`; CSS `animation` has no `infinite`. Painted behaviour unverified. |
| 3 | ≤3 chamfered panels per screen; chamfer from `--chamfer-size` | **Satisfied mechanically.** `--chamfer-size` only; no literal. Per-screen count is a composition rule, unverified. |
| 4 | No shadow elevation outside the overlay tier | **Satisfied.** `--shadow-overlay` is absent from `components.css`; asserted. |
| 5 | Reduced motion: `SignalLine` final-state, no sweep | **Built, not visually verified.** Token override + media query + injected preview CSS all present and asserted; rendered pixels unverified. → operator checklist |

Wave 1's gate is **not cleared**. Items 1 and 5 need a browser. Proceeding to
Wave 2 regardless, per instruction.

## Complete this session

| Unit | Components | Tests |
|---|---|---|
| Gallery | — (surface) | 18 |
| Wave 1 gate statement | — | — |
| Web total | 13 Wave 1 + gallery | **77** |
| Package total | — | **45** |

`pnpm run check`: **122 tests green**, token scan PASS, contrast PASS, fonts PASS.

**Waves 2–7: not started. Screens: none started. Extension overlay: untouched.**

## Next session, in order

1. **Fix the gallery gate leak** (above) and verify all four directions.
2. Re-run `pnpm --filter @pass/web build`, confirm the two greps return nothing.
3. **Deploy to Vercel** — not yet done for any Stage K work. Record the URL.
4. **Wave 2** — actions and form controls: `Button`, `IconButton`, `LinkButton`,
   `SegmentedControl`, `Field`, `TextInput`, `NumericInput`, `Textarea`,
   `Select`, `LeverageStepper`, `ExpiryControl`, `Checkbox`, `Toggle`,
   `ValidationMessage`. Gate: measured target sizes; press state by computed
   style; focus ring in normal **and** forced-colors; accessible name on every
   icon-only control; validation as text + `aria-live`, never border colour
   alone.
   Note the amended `--color-line-strong: #656577` (3.33:1) is already in place
   and asserted — Wave 2 is where it becomes visible.
5. Wave 3 data display → Wave 4 identity/reputation/state blocks → Wave 5
   overlays and chrome → Wave 6 extension surfaces → Wave 7 screens.

## Operator checklist (open items)

### A. Gallery gate — blocking deploy

Run the two greps in "Exact next step for the gate" above. Both must return
nothing.

### B. Wave 1 gate items 1 and 5 — need a browser

```bash
pnpm --filter @pass/web dev
# open http://localhost:3000/gallery
```

1. **375×812 and 1280×800.** Confirm every variant renders; nothing clipped,
   ellipsized, or broken mid-word; no horizontal scrollbar at either width.
2. **768 and 1440** — spot-check layout.
3. **Reduced motion:** toggle ON. The signal line must be fully drawn with **no
   sweep**, and nothing may move.
4. Report per breakpoint: pass/fail, plus anything clipped.

### C. Font paint check — still open, deferred by the operator

`pnpm run check:fonts` proves the files are correct; it does not prove they
paint. Run all nine, expect `true`:

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

Network tab → `fonts`: nine requests to `/fonts/*.woff2`, **all 200**, no
third-party origin. **Zoom 200% on a heading — a serif means a face did not
resolve** and the whole type system fell back; no test catches that.

## Standing constraints

- No browser automation. Everything is "built, not visually verified".
- No UI framework, component library, or animation library. Testing tools only.
- Tailwind stays until Wave 7.
- Extension overlay untouched (Wave 6).
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan to fit a component. Add a token.
- Keep `PENDING_MIGRATION` current; the ratchet fails on too many or too few.
