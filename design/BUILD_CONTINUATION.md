# Stage K — build continuation

**Written:** 2026-10-06 (seventh revision — Landing shipped and deployed)
**Deadline note:** screens first. Wave order is subordinate to screen visibility.

## Current SHA

`ebcd852` — `feat(design): landing screen`

Pushed to `main`. Tree clean.

## Deployed

**https://pass-web-dun.vercel.app** — `/` → **200, serves the new landing**
· `/gallery` → 404 (gate holds)

Verified in the deployed HTML: hero copy, `Explore Passes`, `Create a Pass`,
the loop, the support line, `pass-hero-line`. The old light shell (`bg-white`,
`text-neutral-900`, `max-w-6xl`) is **absent**.

## Complete

| Item | Detail | Tests |
|---|---|---|
| Wave 0 | tokens, fonts, dark base, 3 checks | — |
| Corrections | G-15, G-16, §2.9 errata | — |
| DOM harness | — | 3 |
| Motion helpers | 10 specs | 12 |
| Wave 1 | 13 components | 44 |
| Wave 2 | 14 components | 30 |
| Gallery | — | 18 |
| **Landing (§10.1)** | **first screen** | **18** |
| **Total** | **27 components + 1 screen** | **170** (125 web + 45 package) |

lint ✅ · typecheck ✅ · tokens ✅ · contrast ✅ · fonts ✅

## Next session — Pass detail (§10.3)

**Step 1: build Wave 3's `StatusChip` first.** It does not exist and §11.7
specifies it exactly: uppercase mono, text-first, colour is a secondary cue, and
**no chip uses a filled accent background.** The mapping is in §11.7:

| State | Treatment |
|---|---|
| `DRAFT`, `EXPIRED`, `CANCELLED`, `INVALIDATED` | tertiary text, hairline border |
| `ACTIVE`, `OPEN` | `--color-text-primary`, hairline border |
| `ENTRY_PENDING` | `--color-accent-text`, accent hairline |
| `TP_HIT` | `--color-data-positive`, hairline |
| `SL_HIT` | `--color-data-negative`, hairline |
| `MANUALLY_CLOSED` | `--color-text-secondary`, hairline |

**Step 2: build Pass detail** at `/p/[publicId]`. `DESIGN.md` §10.3 and
`UX_SPEC.md` §5 fix the order: status → asset+direction → trader + Ethos →
ENTRY/TP/SL/LEVERAGE → thesis → market context → takers → TAKE PASS. Use the
existing `ChamferPanel` for the plan block, `CoordinateGrid` + `CoordinatePair`
for the four levels, `Reticle` at the panel's top-left, `Button` primary for
TAKE PASS.

Rules that will bite: the three price levels are **equal weight and never
colour-coded** (§11.3); `BTC LONG` is the largest element on the page; PASS
performance and Hyperliquid account performance stay in separate blocks (§11.4).

**Step 3: Trader profile (§10.4)** — needs Wave 4's `PerformanceBlock` and
`ReputationBlock` with a **mandatory `Rule` between them** (D-007 / PRD §12, a
P0 anti-pattern to merge them).

Verify: `/p/UvvuxpWPZ4` (seeded demo Pass) and `/u/turnttfup99`.

## Still on provisional UI at the deadline

**Screens not rebuilt — 12 of 13:**
- §10.2 Discover
- §10.3 Pass detail ← **next**
- §10.4 Trader profile
- §10.5 Create Pass
- §10.6 Take flow (4 steps)
- §10.7 Stale Pass interstitial
- §10.8 My Passes (dashboard)
- §10.9 Executions
- §10.10 Profile and connections
- §10.11 Onboarding and connect
- §10.12 Error and not-found
- §10.14 Social preview / OG

**Primitives those screens still need — Wave 3–6:**
- Wave 3: `StatBlock`, `StatRow`, `DataTable`, `DataCell`, `PriceCell`,
  `PnlCell`, **`StatusChip`**, `Tag`, `Timestamp`, `Address`, `DirectionBadge`
- Wave 4: `Avatar`, `HandleBlock`, **`ReputationBlock`**, **`PerformanceBlock`**,
  `ConnectionChip`, `LoadingBlock`, `EmptyBlock`, `ErrorBlock`,
  `UnavailableBlock`, `StaleBlock`, `PermissionBlock`, `RejectedBlock`
- Wave 5: `Dialog`, `BottomSheet`, `Popover`, `Tooltip`, `Toast`, `Sidebar`,
  `BottomNav`
- Wave 6: `ExtensionBadge` harmonisation (§10.13) — the extension overlay is
  still the neutral on-X palette, not PASS's

**Operator verifications outstanding:**
1. **Landing** — hero and CTAs visible in the first viewport at 375×812 and
   1280×800; CTA target ≥44px; reduced motion renders the signal line with no
   sweep.
2. **Target sizes** — no jsdom box has layout, so every `--size-target-min`
   declaration is unmeasured.
3. **Press state** — click and read computed `transform` (expect `scale(0.98)`).
4. **Focus ring in forced-colors.**
5. **Rendered contrast** — currently proven against token values, not pixels.
6. **Font paint check** — below.
7. **Gallery** in development at both viewports.

## Operator checklist — font paint check

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
third-party. **Zoom 200% on a heading — a serif means a face did not resolve**
and the whole type system fell back.

## Standing constraints

- No browser automation. Everything is "built, not visually verified".
- No UI framework, component library, or animation library. Testing tools only.
- Tailwind stays until Wave 7. `layout.tsx` and `page.tsx` are off it; the other
  12 screens are still utility-class based.
- Do not edit `SKILL_FRONTEND_DESIGN.md`, `docs/DECISIONS.md`,
  `docs/SECURITY_SPEC.md`, or `docs/API_CONTRACTS.md`. `design/DESIGN.md` only as
  a logged amendment — four exist, in `design/README.md`.
- Do not relax the token scan. Add a token.
- Keep `PENDING_MIGRATION` current; the ratchet fails on too many or too few.
