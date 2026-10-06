# Stage K — build continuation

**Written:** 2026-10-06 (fifth revision — gallery gate fixed, deployed)
**Status:** clean tree, deployed, gate verified.

## Current SHA

`defe3b9` — `chore(vercel): track the generated apps/web/.gitignore`

Pushed to `main`.

| SHA | Commit |
|---|---|
| `d1420e7` | `fix(design): gate gallery at build time so prod excludes it` |
| `06d0c39` | `chore(vercel): add .vercelignore so deploys upload a buildable tree` |
| `defe3b9` | `chore(vercel): track the generated apps/web/.gitignore` |

## Deployed

**https://pass-web-dun.vercel.app**

| Path | Status |
|---|---|
| `/` | **200** |
| `/gallery` | **404** |
| `/fonts/archivo-600.woff2` | **200** |
| Gallery markers in deployed output | **absent** |
| Stage K tokens in deployed CSS | **present** — `--color-canvas`, `#0a0a0a`, `Archivo`, `IBM Plex Mono`, `--chamfer-size` |

**What is live:** Wave 0's token layer, fonts, and dark-only base; Wave 1's
component CSS. **What is NOT live:** the screens. Landing, Discover, Trader
profile, Pass detail, Take flow and the rest are still the Stage J provisional
UI — Wave 7 rebuilds them. Do not describe the deployed screens as Stage K work.

## Gallery gate — RESOLVED

Build-time module resolution gate. `next.config.mjs` aliases `pass-gallery` to
`src/gallery/stub.tsx` (whose entire body is `notFound()`) when
`NODE_ENV=production`, so the implementation never enters the module graph.

Two obstacles cost real time and are documented in `d1420e7` because both look
like "the fix failed" rather than "configuration is wrong":

1. `#gallery` as the specifier — Next reserves `#` for its own internal imports.
2. Declaring the specifier in tsconfig `paths` — **Next injects tsconfig paths
   into webpack `resolve.alias`, overriding the `webpack()` hook.** Confirmed by
   logging from inside the hook: it ran three times with `production=true` and
   the gallery still shipped. Fixed by declaring the module ambiently in
   `src/gallery/pass-gallery.d.ts` and leaving resolution entirely to webpack.

**Verify after any change to `next.config.mjs` or `src/gallery/`:**

```bash
pnpm --filter @pass/web build
Get-ChildItem -Recurse -Path apps/web/.next -Include *.js,*.html |
  Select-String -Pattern "narrow-width stress","component gallery" -List
# must return nothing
```

## Deploy notes for next time

- Deploy from the **repo root**. `vercel --cwd apps/web` FAILS: it makes
  `apps/web` the build root, where there is no `pnpm-lock.yaml`.
- Use `vercel --prod --yes --archive=tgz`. Without it the upload exceeds
  Vercel's 15000-file limit.
- `.vercelignore` now excludes `node_modules`, `.next`, `dist`, `.vercel`.

## Complete

| Unit | Components | Tests |
|---|---|---|
| Wave 0 — Foundation | tokens, fonts, base, 3 checks | — |
| Corrections (G-15, G-16, errata) | — | — |
| DOM harness | — | 3 |
| Motion helpers | 10 specs | 12 |
| Wave 1 | 13 | 44 |
| Gallery | — | 18 |
| **Total** | | **122** (77 web + 45 package) |

`pnpm run check`: green — 122 tests, token scan PASS, contrast PASS, fonts PASS.

## Next session — Wave 2

**Wave 2 — actions and form controls** (`DESIGN.md` §9.3, §9.4):
`Button`, `IconButton`, `LinkButton`, `SegmentedControl`, `Field`, `TextInput`,
`NumericInput`, `Textarea`, `Select`, `LeverageStepper`, `ExpiryControl`,
`Checkbox`, `Toggle`, `ValidationMessage`.

Re-read `DESIGN.md` §9.3, §9.4, §2.5, §5.3, §6.4, §11 and the plan §3 Wave 2
gate before starting.

Wave 2's gate:
- every interactive element meets `--size-target-min` (44px), **measured**;
- press state verified by **computed style after the press**, per variant/size;
- visible focus ring in **normal and forced-colors**;
- accessible name on every icon-only control;
- validation as text + `aria-live`, **never border colour alone**.

Add the new components to `src/gallery/` so Wave 2's variants are covered.

Then: Wave 3 data display → Wave 4 identity/reputation/state blocks → Wave 5
overlays and chrome (`Sidebar`/`BottomNav` must **export their dimensions as
tokens** so reserved and rendered space cannot drift) → Wave 6 extension surfaces
→ Wave 7 screens + Tailwind removal.

## Screens

**None built.** 13 web screens from `DESIGN.md` §10: §10.1 Landing · §10.2
Discover · §10.3 Pass detail · §10.4 Trader profile · §10.5 Create Pass · §10.6
Take flow · §10.7 Stale Pass interstitial · §10.8 My Passes (dashboard) · §10.9
Executions · §10.10 Profile and connections · §10.11 Onboarding · §10.12
Error/not-found · §10.14 Social preview.

## Operator checklist

### A. Gallery in development — unverified (no browser)

```bash
pnpm --filter @pass/web dev   # then open http://localhost:3000/gallery
```
1. 375×812 and 1280×800 — every variant renders; nothing clipped or broken
   mid-word; no horizontal scrollbar.
2. 768 and 1440 — spot-check layout.
3. Reduced-motion toggle ON — signal line fully drawn, **no sweep**; nothing moves.

### B. Wave 1 gate items 1 and 5 — need a browser

Same gallery pass as A. Items 2, 3, 4 are satisfied mechanically (asserted):
`signalLineReveal` is the only spec on `--duration-deliberate`; `--chamfer-size`
only; `--shadow-overlay` absent from `components.css`.

### C. Font paint check — still open

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

Now runnable against production. Network → `fonts`: nine `/fonts/*.woff2`, all
200, no third-party origin. **Zoom 200% on a heading — a serif means a face did
not resolve** and the whole type system fell back; no test catches that.

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
