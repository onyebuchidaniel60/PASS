# Stage K.2 — continuation

**Written:** 2026-10-07 (fourteenth revision — the reference rebuild)

**Stage K shipped thirteen screens that were compliant and wrong.** The operator
opened them against `design/references/` and reported them generic, dull, and
not alive. The cause was not a failure to follow `design/DESIGN.md` — it was that
`DESIGN.md` never described the reference's actual visual language. That is now
fixed at the document, and this note records how far the rebuild got.

## 1. What is done

| # | Task | State |
|---|---|---|
| 0 | Extension diagnostic | **Done.** Case 3 (operator side) plus four real code defects fixed. See §2. |
| 1 | `DESIGN.md` §14 — the extracted visual language | **Done.** 15 subsections, §14.0–§14.15. Closes G-2. |
| 2 | Token layer for §14 | **Done.** 4 groups of tokens added; `tokens.css` and the ratchet both clean. |
| 3 | Shared components for §14 | **Done.** 16 components, 48 tests. |
| 4 | Logo, mark, favicon | **Done.** §14.14. `icon.svg` + generated `apple-icon.png` + `Logo`/`LogoMark`. |
| 5 | Landing rebuild | **Done.** 27 tests. |
| 5 | Discover rebuild | **Done.** 21 tests. Card grid, ticker, chips. |
| 6 | Informational pages | **Done.** `/how-it-works`, `/faqs`, `/help`, `/contact`. 20 tests. |
| 7 | Topbar three-region fix | **Done** (CSS + layout). See §5. |
| 8 | Overflow guards | **Partially done.** Rules are in; per-screen verification outstanding. See §6. |
| 5 | **Pass detail, trader profile, take flow** | **NOT STARTED. This is the next step.** See §7. |
| 5 | My Passes, Executions, Profile, Onboarding, errors | **NOT STARTED.** Lower priority. |

`pnpm run check` is green: 45 package tests, **416** web tests across 23 files,
token ratchet clean, contrast clean apart from the one recorded residual, fonts
verified.

## 2. Extension diagnostic — Case 3, plus four real defects

The operator reloaded the extension and saw no change. **The build was shipping
the harmonized CSS correctly.** Every candidate cause was checked and ruled out:

| Case | Checked | Result |
|---|---|---|
| 1 — CSS not in build | `grep pass-overlay-card dist/content.css` | Present. All six harmonized ember values present. `dist/content.js` is an IIFE with no import. |
| 2 — manifest not loading it | `dist/manifest.json` | `content_scripts[0].css` is `["content.css"]`; the file exists. |
| 4 — scoped wrong | every selector in `dist/content.css` | All ten selectors start `#pass-overlay-card`. |
| 5 — script throwing | `dist/chunks/config.js` API host vs `host_permissions` | `pass-api-production.up.railway.app` in both. The endpoint returns `{"found":true,…}` for a known handle. |

**So it is Case 3, operator side — with one caveat that is worth knowing.**
Chrome does **not** re-inject a content script into a tab that is already open.
Reloading the extension at `chrome://extensions` reloads the worker and the
popup; the X tab keeps running the previous script with the previous stylesheet
until the tab itself is reloaded.

Four code defects were fixed anyway, because each one made the fault harder to
diagnose than it needed to be:

1. **`copy-static.mjs` preserved source mtimes.** `fs.copyFileSync` on Windows
   goes through `CopyFileEx`, which keeps the source file's timestamp. After a
   build, `dist/content.js` carried the build time while `dist/content.css` still
   carried the last time that *source* was edited — so the "is dist newer than
   the commit?" check reports a stale stylesheet that is in fact current. Every
   copied file is now restamped with the build time.
2. **No build stamp anywhere.** Added `__PASS_BUILD__` via `define` in both vite
   configs. The content script logs it on every page load and the popup header
   shows it, so "did the reload reach the running code" is answerable instead of
   assumed.
3. **`manifest.json` declared `web_accessible_resources: ["pass-panel.css"]`** —
   a file that has never existed in `dist`. Dead reference, removed.
4. **No first-line log.** The content script now logs
   `[PASS] css loaded at <ts> · build <stamp> · url=…` before any watcher is
   registered.

## 3. `DESIGN.md` §14 — what was added

The whole section is new and nothing in §§1–13 was edited to match code. Subsections:

| § | Subject | Notable decision |
|---|---|---|
| 14.0 | Typeface substitution | Reference uses Clash Display / Space Grotesk / JetBrains Mono; PASS ships Archivo / Inter Tight / IBM Plex Mono. **Substitution is logged, not a gap.** The gap that produced the complaint is size, weight, tracking and colour, not typeface identity — and the three committed faces are provenance-verified by `scripts/check-fonts.mjs`. |
| 14.1 | Backgrounds | Radial ember wash, three strengths; 4% grain as an inline `feTurbulence` tile; 5% ghost watermark. **Flat rule:** data-heavy surfaces get grain and no wash. |
| 14.2 | Corner brackets | 28px legs, `#3a3a46`, inset 8px. **Rationed to four uses in the whole product.** Landing spends two. |
| 14.3 | Numbered eyebrows | `\\  NAME  \\` … `\\  07  \\`, ember delimiters. Per-screen numbering table. |
| 14.4 | Display headlines | 34 → 92px across four breakpoints. **One ember word per line**, lines authored not wrapped. Exact copy and accent word per screen. |
| 14.5 | Data cards | Full anatomy: darker-than-canvas surface, lit top edge, bottom-corner chamfer, identifier, sub, value + same-baseline unit, metric rows, sparkline, status row, action. Six card types specified for PASS. |
| 14.6 | Status badges | Icon + word, nine lifecycle states mapped to tones. Colour and icon reinforce the word. |
| 14.7 | Live indicators | 6px dot, 2s pulse, **two iterations then rest.** `--live-pulse-duration` overridden to `0ms` under reduced motion, not shortened. |
| 14.8 | Ticker | 28px bar, 4–6 entries, **no marquee**, never renders empty. |
| 14.9 | Chip buttons | **Chamfered, not rounded** — the reference chips are cut at 45°, consistent with §5.1/§5.2. This overrides the "rounded ~8px" reading of the task brief. |
| 14.10 | Numbered step grid | 2×2, outlined circle badge, **data card in the visual slot, never an image.** |
| 14.11 | Terminal density | 34px rows, mono tabular, hairline separators, no zebra, **no horizontal scroller at any width.** |
| 14.12 | Iconography | 1.5px stroke, 14px in a 20px box. |
| 14.13 | "Alive" | A **closed list of six** permitted behaviours and an explicit forbidden list. |
| 14.14 | The PASS mark | **Closes G-2.** See §4. |
| 14.15 | Overflow discipline | Six mechanical rules. See §6. |

## 4. The mark — the visual decision, and why

`PASS` in heavy caps, with two ember elements: a **signal line** at the optical
mid-height running the full width and overshooting the final `S`, and a
**reticle in the P's counter** — a ring crossed by that line with a filled dot on
its circumference at 45°.

**Why the P.** The reference puts its ring-and-dot in the one letter with a round
counter: its `O`. Of PASS's four letters only the **P** has one. The `A`'s
counter is triangular and a circle does not sit in it; the `S` has no counter at
all, so a reticle there collides with both terminals.

**Why a reticle and not an orbit.** A ring-plus-dot is generic. A ring-plus-dot
that is *also* PASS's own §9.2 reticle and *also* sits on PASS's own §9.2 signal
line is the product's language. The mark still reads with the ring removed —
it degrades to `PASS` struck through — which matters at 24px.

**G-2's other half still binds:** the reference's mark must not be copied. The
mark above is derived from PASS's own signature devices, and §14.14 says so.

## 5. Topbar — the operator's "connect wallet is at the centre" complaint

Real fault, real fix. The old shell was a flex row with the nav in the flow and
the actions pushed right by `margin-inline-start: auto`. That works only while
the nav is narrower than the leftover space; as soon as it is not, the auto
margin collapses and the wallet button drifts toward the middle — at 375px it
lands dead centre.

Now three explicit grid tracks, one per region, at every width:

- **desktop / tablet** — `auto | 1fr | auto`. Wordmark left, four destinations
  centred in their own track, wallet hard right in a track that cannot shrink.
- **mobile (≤767px)** — a two-row grid: `brand actions` / `nav nav`, with the
  nav on its own row scrolling horizontally rather than wrapping the bar onto a
  second line and doubling its height.

Footer gained the informational links and a brand block; the eight links no
longer run off the end of one long line.

## 6. Overflow and overlay — partial

**Rules are in** (§14.15, and `.pass-info-cards > * { min-width: 0 }` etc. in
`components.css`):

1. `min-inline-size: 0` on every grid child — the most common cause of the
   reported overflow, because a long unbroken token sets the min-content width.
2. Figures are `nowrap` + `overflow: hidden` + `text-overflow: ellipsis`.
3. Handles and tickers truncate, never wrap (`.pass-truncate`).
4. **The wash, the grain and the watermark are `position: absolute` inside a
   `position: relative; overflow: clip; isolation: isolate` shell.** This is the
   direct fix for "overlay on other elements": an unclipped absolute wash escapes
   its shell and paints over the next section. `.pass-wash` enforces it and the
   Landing and all four informational pages use it.
5. Nothing is `position: fixed` except the topbar and bottom nav.
6. `min-inline-size: 0` plus `max-inline-size: min(100%, …)` floors on every grid.

**Not done: measurement.** There is no browser in this environment, so "no
element exceeds the viewport at 375px" and "no element overlaps a sibling" are
**unverified**. They need the operator. Treat the Landing, Discover and the four
informational pages as *probably* clean and *not confirmed*.

## 7. The next step — Pass detail (§10.3)

Everything §14 needs already exists. Pass detail is next because it is the
core conversion surface and it is where three of §14's devices land at once.

Per §14, the screen needs:

- `CornerBracketFrame` on the top card (**the third of the four** — Landing has
  spent two, `/how-it-works` one, so exactly one remains).
- `Surface strength="section"` behind the hero, grain included.
- `DisplayHeadline` with `[{BTC}], [{LONG, accent}]` — the only screen whose
  headline carries a live value, so §14.4's gradient variant is **forbidden**
  here and the asset/direction must be set in the data face, not the display
  face (§3.2 binds in reverse).
- `MetricCardRow` with exactly §11.3's set: Entry, Take profit, Stop loss,
  Leverage, R:R. No additions.
- A `DataCard` market snapshot with `DotEyebrow` + `LiveDot`, a `Sparkline`, and
  rows for 24h change / 24h volume / funding.
- A trader mini-card: avatar, handle, Ethos, active count.
- `StatusBadge` for the state, `SignalLine` NOT used here (§6.4 limits the sweep
  to the hero).
- Thesis, then the CTA. Keep the existing `PassDetailClient` structure and swap
  the presentation; do not rewrite the data flow.

Then **trader profile** (§14.4: `@handle is` / `verified on PASS.`), then the
**take flow** (`You author` / `your own size.`). After those three, the remaining
screens (My Passes, Executions, Profile, Onboarding, errors) are lower risk:
they are data-heavy, §14.1's flat rule applies, and the primitives already exist.

## 8. Operator checklist for this session

1. **Extension, exactly this order.** `chrome://extensions` → reload PASS →
   **then reload the X tab** (the tab reload is the step that was missing) →
   open `x.com/turnttfup99` → DevTools console on the X page. Expect
   `[PASS] css loaded at <ts> · build <ISO stamp> · url=…`. If that line is
   absent, the tab is still running the old build. The popup header also prints
   the same stamp. The card should now be ember-on-near-black unconditionally,
   with `Inter Tight` and no `prefers-color-scheme` variant.
2. **Landing.** Gradient wash behind the hero, visible grain, a `PASS` watermark
   at 5%, bracket frame around the hero, three-line headline with `trade.` in
   ember, lede, one signal line, two CTAs, `01/02/03` eyebrows, the five-step
   loop, a 2×2 step grid inside a second bracket frame, four chips.
3. **Logo.** Topbar wordmark is the SVG mark with the strike-through and the
   reticle in the P. Browser tab shows the favicon.
4. **Discover.** A **grid of cards**, not a list of rows. Ticker bar under the
   header. Three chamfered chips with exactly one ember-filled. Each card:
   `BTC LONG` in ember, `Published just now`, `113,400` oversized with
   `per unit` on the same baseline, metric rows for Take profit / Stop loss /
   R:R, a status row, and an ember `Open Pass ↗`.
5. **Topbar at 375 / 768 / 1280 / 1440.** The wallet button must be hard right at
   every width. This was the reported fault.
6. **The four informational pages.** `/how-it-works` `/faqs` `/help` `/contact`.
   Check the FAQ disclosure marker fills ember when open.
7. **Overflow at 375px** on every screen above. §6: unverified from here.
8. **Reduced motion.** The live dot must not pulse; sparklines must render fully
   drawn; the signal line must be in its final state.
9. **Still outstanding from Stage K.** The font-paint checklist in
   `phase-records/PHASE_00_tokens.md` §8.5 — nine `document.fonts.check` calls,
   nine `/fonts/*.woff2` at 200, and **a heading at 200% zoom must not render in
   a serif.**

## 9. Standing constraints

- No browser automation. Nothing here is visually verified. Stage K.2 stays open.
- No UI framework, no component library, no animation library.
- **Never write a file with `Add-Content -Encoding UTF8` or a
  `Get-Content | Set-Content` round-trip in this repo.** PowerShell 5.1 silently
  DROPPED every `§` and `—` in a heredoc and re-encoded `—` as `â€”` on the way
  back, and added a BOM. It happened twice in this session and was caught only
  by an encoding check. Use the editor tools, or
  `node $TEMP/opencode/append-utf8.mjs <target> <fragment>`.
- Do not relax the token scan. Add a token.
- `NEXT_PUBLIC_API_URL` must be set to build locally.
- §14 is an addition sourced from the references. It is not permission to
  retro-fit whatever was already built.
