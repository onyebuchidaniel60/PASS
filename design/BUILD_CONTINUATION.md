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

## 9. Stage K.3 — DONE, deployed at `832c7ac`

The three video-critical screens and the wallet control are built, checked, and
deployed. Full detail, including every judgement call where the brief and
`DESIGN.md` disagreed, is in
[`phase-records/PHASE_08_stage_k3_rebuild.md`](./phase-records/PHASE_08_stage_k3_rebuild.md).
Read that before changing any of it.

Live: `https://pass-web-dun.vercel.app` — `/p/{id}`, `/u/{slug}`, and
`/passes/{id}/take` all serve 200.

`pnpm run check` exits 0 at **526 tests** (was 441). Stage K.3 added 59
assertions that pin the §14 reference language on the three screens; §10's
behavioural contracts were already asserted and stayed green throughout.

Three things the operator should know before the visual pass:

1. **The bracket ration is now spent.** Landing has two, `/how-it-works` one,
   **Trader profile one**. That is all four. Pass detail and the Take flow
   deliberately do **not** have one — adding a fifth would turn a ration into a
   border style. Each screen asserts its own count.
2. **The Ethos score is rendered once per screen, not twice.** The K.3 brief
   listed it on the trader mini-card; §11.4 and D-007 put it in the reputation
   block, so that is where it is. See PHASE_08 §2.1. Reversible if you disagree,
   but one of the two placements has to go.
3. **Win rate, average R and TP-hit rate are not on the profile** because the API
   does not return them. The screen says so in text rather than estimating. If
   you want them, that is a backend change — do not let a future pass "fix" this
   by computing them from the published/completed counters.

**Known tooling gap:** `check-design-tokens.mjs` does not detect a `var()`
referencing a token that does not exist. Eight such references shipped in this
phase and were only caught by hand. A resolution check is the obvious next
script and is still unwritten.

## 10. Landing/footer regression + live provider reads (2026-10-07)

Deployed at `7ffedba`. Live modes, from `GET /health`:

```
hyperliquidReads: live     hyperliquidExecution: mock
ethos: live                x: mock
```

### Footer regression — three CSS causes, all silent

Operator report was "packed up the home and bottom elements". §14.15 was **not**
the cause: `.pass-wash` has `isolation: isolate` + `overflow: clip` and the hero
text sits inside a `z-index: 1` parent, so nothing was clipped or overlapped.

1. `.pass-footer` declared `max-width` **twice** — `--layout-content-max` (1280px)
   then `--measure-body` (68ch). CSS resolves duplicates last-wins with no
   warning, so the footer silently rendered at 68ch beside 1280px of content.
2. `.pass-footer-grid` had **no CSS rule at all**. The "grid" was a plain block
   div, so brand and links stacked with no gap at every width.
3. `.pass-footer-links` is a `<ul>` with **no rule**, and `globals.css` carries
   no `ul`/`ol` reset by design (apps/web is on the token layer; resets are
   per-primitive). So it painted browser-default discs and a 40px indent.

Also fixed: `.pass-landing-shell` had no padding, and `overflow: clip` on a
zero-padding element cuts the wash, grain and ghost watermark flush on all four
sides — which is why the hero read as a cropped slab. And `.pass-landing-lede`
had no rule, so the hero's one prose paragraph ran the full 1280px.

None of this changed a class name, so every existing assertion stayed green.
The 13 new assertions read the stylesheet directly.

### Two provider bugs found by calling the APIs

1. **Ethos** — the adapter called `/api/v1/reputation/{ref}` and
   `/api/v1/x/{handle}`. **Both 404.** `getJson` mapped 404 to `null`, so
   `ETHOS_MODE=live` would have shown "no Ethos data" for *every* profile —
   indistinguishable from a trader having no reputation (D-007). Rewritten
   against the verified v2 endpoint `GET /api/v2/user/by/x/{username}`, which
   returns score, review split, vouch count and profile link in one call.
   It now also throws on 5xx instead of reporting an outage as no reputation.
2. **Hyperliquid** — `metaAndAssetCtxs` returns the **tuple** `[meta, ctxs]`,
   not an object with `universe`/`ctxs` keys. The client typed it as the object
   shape, so `raw.universe` was always `undefined` and `GET /api/v1/markets`
   answered `{"assets":[]}` with **HTTP 200** on a live deployment. Silent and
   200, which is why it survived every typecheck and test. 234 assets are
   available; none were being returned.

### D-021 — reads and execution split

`HYPERLIQUID_MODE` gated reads *and* `relaySignedAction` together, so asking for
live prices armed real orders. Split into `HYPERLIQUID_READS_MODE` (Info API) and
`HYPERLIQUID_MODE` (Exchange API, which additionally requires reads). Live
writes with mock reads is rejected at construction. See
[`docs/DECISIONS.md`](../docs/DECISIONS.md) D-021.

### Two open execution gaps — do not read past this line

`docs/EXECUTION_READINESS.md` is the full report. The one that matters:

**A Take today sends a single entry order with no take-profit or stop-loss leg.**
`buildExchangeRequest` signs one `buildOrderAction`, and nothing places an exit
after the fill — while the Pass on screen advertises both. A real Take would
leave an **unprotected open position**. Anyone testing on mainnet must be at the
Hyperliquid UI with the close button ready.

Also fixed while writing that report: a relay that *returned* a rejection rather
than throwing was recorded as a real execution with an empty `provider_order_id`.
`execution-service.ts` now treats a returned rejection as a rejection.

### Still unverified

Everything visual, and unchanged: no browser automation. The §4 operator
checklist still applies. `pnpm run check` is green at **578 tests**.

## 11. Playwright verification is live — measure, do not guess

The "no browser" period is over. `pnpm --filter @pass/web verify` runs 14 routes
at 375x812 and 1280x800 and writes
[`design/verify/latest-mobile.txt`](./verify/latest-mobile.txt) and
[`latest-desktop.txt`](./verify/latest-desktop.txt).

It measures overflow, overlap, target size, clipped text, full-width card
actions, above-fold landmarks on Pass detail, console errors and non-2xx API
responses. Findings are collected as DATA, not thrown, so one broken route
cannot hide the other thirteen. It is deliberately NOT in `pnpm check` — it needs
a running server.

### Run it against production, not `next dev`

`E2E_BASE_URL=https://pass-web-dun.vercel.app pnpm --filter @pass/web verify`

Against `next dev` every API call is **CORS-blocked** (origin
`http://localhost:3000` is not in `CORS_ORIGINS`), so every data-driven screen
renders its error state and the whole report is meaningless. It is also ~12x
slower: 20 minutes per viewport cold versus 1.6 minutes.

### Three harness false positives, learned by running it

The first run reported 86 mobile findings. Most were the harness's fault, and
fixing them was as important as fixing the app:

- **Decorative layers counted as overlaps.** `.pass-wash-layer`, `.pass-grain`
  and `.pass-watermark` sit behind content by design (14.1) and were reported as
  colliding with everything. Now excluded structurally: inert
  (`pointer-events: none`) AND behind content (negative z-index, or a known
  decorative class).
- **`.visually-hidden` links counted as targets.** They are 1x1 on purpose and
  were 14 findings on /discover alone.
- **Ticker children counted as overflow.** `.pass-ticker` is `overflow-x: auto`
  by design; 13 findings. Elements inside a horizontally scrollable ancestor are
  now excluded, and real page overflow is caught separately by the document
  `scrollWidth` check.

Also: `channel: "chromium"` because the headless-shell download fails on DNS
here; `waitUntil: "load"` because `networkidle` never settles against a dev
server's HMR websocket; and 401 on `/api/v1/me` is allowlisted because the
harness runs signed out and that is the auth gate working.

### Result: 86 findings down to 3

Overflow, overlap, target size, clipped text and full-width card actions are now
**0 on all 14 routes at both viewports**. The 3 remaining are the browser's own
automatic console log for the signed-out `401` on `/api/v1/me`.

Real defects found and fixed, each traced to a measurement — see the
`fix(design)` commit. The root cause behind three of them was `.pass-btn` having
no `min-height` on its base class, so every link-styled-as-button rendered at
24px instead of 44px.

### The finding this harness could not fix

**The Pass detail "Take Pass" CTA sits at y=2944px on a 1280x800 viewport and
y=3169px on 375x812** — roughly four viewports down, on the screen whose entire
job is converting a reader into a Taker.

This is **recorded, not fixed**, because `DESIGN.md` does not cover it. §8.4
sanctions a fixed bottom *navigation* bar on mobile and §10.3 puts the CTA after
the thesis, but nothing authorises a sticky or pinned CTA bar. AGENTS.md is
explicit: if a screen needs a visual decision `DESIGN.md` does not cover, stop
and record the gap rather than invent visual language.

Options for whoever decides this: a sticky mobile action bar (needs a §8.4-style
reserved-clearance token so content is never occluded), a floating Take button,
or moving the CTA above the long sections. All three are design decisions with
conversion consequences.

## 12. X identity surface and onboarding routing

X OAuth went live end to end. What it did not have was anywhere to show it.

### The topbar actions track now holds two controls

`XIdentityControl`, then the wallet. X first because PASS is identity-first:
the handle is who a Trader **is**, the wallet is only what they can sign with,
and a trader with one but not the other is still a trader.

The fourth state is the one worth knowing about. While `/me` is in flight the
control renders **nothing**. Rendering "Sign in with X" and hiding it a moment
later flashes a button on every page load, and a user reaching for it is
reaching for something about to move. An absent control beats one that lies
about its own stability. That assertion is the load-bearing one in the 16 tests.

No third-party widget, for the reason `WalletControl` already established: X
OAuth needs no SDK to *begin* — it is a 302 to our own backend, which redirects
to X — so the only foreign surface is X's own consent screen, which is where it
belongs.

### Onboarding routing, both layers

Layer 1 is the callback: no profile → `/onboarding?x=connected`, profile →
`/settings?x=connected`. `x=connected` rides on **both** branches, because a new
user needs the confirmation too or their successful sign-in looks identical to a
no-op.

Layer 2 is `OnboardingRedirectGuard` on `/settings`, `/me/passes`,
`/me/executions`. Layer 1 only helps users who connect X *after* it existed;
anyone already holding a profile-less session — including the operator's own
account — would otherwise land wherever they clicked. Deliberately a hook and not
global middleware: a blanket redirect fights the callback's own redirect,
intercepts `/onboarding` and loops, and fires on public routes where having no
profile is correct.

### One defect the harness caught, and one it caused

The harness found the second topbar control overlapping the wordmark by 38x44px
at 375px — the `max-content` actions track grew past what the brand and `1fr` nav
could yield, and with no shrink the grid let them sit on top of each other.
Fixed with a shortened label below the mobile breakpoint ("Sign in", "Connect"),
because §8.5 and WCAG 2.5.8 care about both controls staying hittable far more
than about a word count.

Worth recording because it is a kind of bug that only tests catch: my first fix
used an `aria-hidden` + `visually-hidden` pair of spans, which doubled the
button's text content to "Connect walletConnect wallet" and broke a Stage K
assertion. Invisible on screen, fatal to anything reading `textContent`. The
shipped version is one span whose full wording is both the accessible name and
the text content, with only the rendered glyphs shortened.

### Still true

The Pass detail "Take Pass" CTA remains ~3000px down (§11). Recorded, not fixed:
`DESIGN.md` does not authorise a sticky CTA, and AGENTS.md forbids inventing one.

## 13. Standing constraints

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

## 14. Stage B closure — same-origin session via Next rewrite (2026-10-09)

Deployed at `1757bee` (`fix(auth): same-origin session via Next rewrite`).
Live: `https://pass-web-dun.vercel.app`.

### The bug

The X OAuth round trip completed and the identity was written, but the
session was invisible to the web app: the browser called the Railway API
domain cross-origin (`NEXT_PUBLIC_API_URL` prefix in `client.ts`), and a
`SameSite=Lax` session cookie is never sent on cross-site fetch — so `/me`
always answered 401, onboarding never recognised the connection, and the
topbar never showed the handle. The callback's `Set-Cookie` was also
Railway-scoped (`X_REDIRECT_URI` pointed at the Railway domain), so the
Vercel domain never held a session at all.

### The fix — Option A (rewrite proxy)

1. `apps/web/next.config.mjs` — `rewrites()`: `/api/v1/:path*` and
   `/health` proxy to `NEXT_PUBLIC_API_URL`. Server components
   (`src/lib/api.ts`) still call the API directly; only browser traffic
   goes through the proxy.
2. `src/lib/client.ts` — same-origin `fetch(path)`; the `API_URL` prefix
   is removed and must not be reintroduced.
3. `XIdentityControl` — start navigates to `/api/v1/auth/x/start`
   (same-origin), so the whole round trip stays on the Vercel domain.
4. `DemoBanner` — `/health` same-origin; no second CORS origin.
5. Railway `X_REDIRECT_URI` →
   `https://pass-web-dun.vercel.app/api/v1/auth/x/callback`, so the
   callback's `Set-Cookie` is Vercel-scoped via the proxy.

The cookie is unchanged (`HttpOnly`, `SameSite=Lax`, `Secure` in
production, `Path=/`, no `Domain`) — Lax is correct for same-origin and
satisfies `SECURITY_SPEC.md` §8 and `API_CONTRACTS.md` §2. Relaxing to
`None` to make the cross-site call pass was rejected: fix the
architecture, not the spec. No `NEXT_PUBLIC_*` variable carries a secret
(URLs only, per `DEPLOYMENT_OPERATIONS.md` §5).

### Verified from here (HTTP layer, no browser in this environment)

- `GET /health` via the Vercel domain → 200, live modes
  (`hyperliquidReads: live`, `hyperliquidExecution: mock`, `ethos: live`,
  `x: live`).
- `GET /api/v1/me` via the Vercel domain → 401 with `X-Railway-*`
  headers: the proxy reaches the API and the auth gate answers.
- `GET /api/v1/auth/x/start` via the Vercel domain → 302 to
  `x.com/i/oauth2/authorize` with `redirect_uri` set to the proxied
  Vercel callback URL: the round trip is same-origin and the API picked
  up the new `X_REDIRECT_URI`.
- `tsc --noEmit` clean; web suite 535 passed (pre-deploy run).

### Stage B status: code-complete, operator verification outstanding

The mechanism is deployed, but steps 4–8 of the session brief (incognito
sign-in, `?x=connected` landing, cookie scoped to `pass-web-dun.vercel.app`,
refresh persistence, disconnect, re-connect without looping) need a real
browser with X consent and are **not verified**. Two operator actions are
required first:

1. **X developer portal:** the app's OAuth callback URL must be updated to
   `https://pass-web-dun.vercel.app/api/v1/auth/x/callback`. X rejects a
   `redirect_uri` that is not registered, so sign-in fails until this is
   done.
2. **Incognito run** of brief steps 1–8 against the deployed URL, checking
   DevTools → Application → Cookies for a `pass_session` cookie scoped to
   `pass-web-dun.vercel.app`.

If the proxied `Set-Cookie` is ever observed stripped (Vercel behaviour
change), fall back to Option B (one-time token handoff) per the brief.

### Next task

Stage C — verify the Create Pass flow in the browser. That gate is
currently API-only per the stage-gate audit. Run it after the operator
completes the Stage B browser verification above, since authoring a Pass
requires the session this section just repaired.

## 15. Stage B fix — callback signs into the owning user (2026-10-09)

Deployed at `63748cb` (`fix(auth): sign session-less X callback into the
owning user`). API redeploy `43187b96` SUCCESS; `/health` modes unchanged
(`hyperliquidReads: live`, `hyperliquidExecution: mock`, `ethos: live`,
`x: live`).

### The bug

With consent working, the callback threw `INTERNAL_ERROR` on every
sign-in: `duplicate key value violates unique constraint
"x_connections_x_user_id_key"` (API log, 08:14 UTC). The session-less
callback created a fresh user *before* X had identified them; the
`x_connections` insert then collided with the row the same X account
already owned under its original user (bound pre-proxy). The `x_user_id`
unique index proves the conflicting row belonged to a different user —
the `onConflictDoUpdate({target: userId})` arbiter would otherwise have
handled it silently.

### The fix

`getIdentityByProviderSubject` (`profile-service.ts`) resolves
`(provider, provider_subject_id)` → owning user (`DATA_MODEL.md` §2).
The callback now defers user creation until after `/2/users/me`: known
identity → session for the owning user with the existing upserts (no new
rows); unknown identity → previous create-then-attach behaviour. The
signed-in (reconnect) path is unchanged. No binding is reassigned, no
rows deleted, no migration. `CREDENTIALS_SWAP.md` §X corrected to the
proxied callback URL.

### Tests

`apps/api/src/routes/auth-callback.test.ts` (2 tests, PGlite + stubbed
token endpoint): pre-fix run failed with the byte-identical
`INTERNAL_ERROR` body; post-fix both pass. Full `pnpm test` (102 + 535)
and `pnpm run check` green.

### Residual (recorded, not fixed)

A signed-in user linking an X account bound to *another* user still hits
the same unique violation (loud 500, no silent reassignment). Changing
that path would be a behaviour decision beyond the brief; it is left
exactly as specified.

### Still operator-side

Fresh-incognito X sign-in against the deployed URL (topbar chip, cookie
scope, refresh persistence) — no browser in this environment. Task 0's
prod row counts were also unobtainable from here (no public DB proxy, no
SSH keys); the prod log line is the evidence of record.

## 16. Stage B fix — flat `/me` shape crash (2026-10-09)

Fix commit `fce6fe2`. API redeploy `50992b71` SUCCESS; web redeploy Ready
(Production). `/health` modes unchanged; `/` serves 200, `/api/v1/me`
answers 401 signed out.

### The bug

First successful sign-in crashed every page: `Uncaught TypeError: Cannot
read properties of undefined (reading 'connected')` in the root-layout
bundle (operator console paste). `XIdentityControl` (mounted in the root
layout, so global) read `me.x.connected`, but `GET /api/v1/me` returns a
FLAT payload (`userId, profileSlug, displayName, connections[],
tradingAccounts[], demoMode`) — the nested `x` object never existed on
the wire. It compiled because `clientGet<T>` is an unchecked cast, and
every one of the 16 control tests mocked the invented nested shape. The
`try/catch` in `load()` could not save it: the 200 response stored fine
and the throw happened during render. `XConnectedNotice` had the same
latent read (`state.data.x.handle`).

### The fix

Canonical shape is the flat `connections[]` array: `API_CONTRACTS.md`
§2/§5 are silent on `/me` fields (recorded gap — the contract should pin
them), while the flat shape is what the API returns and what
`SettingsClient` and the guards already consume. Pure client-side mapping
was impossible without parsing the display `label`, so the API gained one
ADDITIVE field — `handle` on the x `connections[]` entry (connection
handle, else identity username, else null). Both nested readers now
derive through the total `xConnection()` selector (`apps/web/src/lib/me.ts`);
unknown shapes map to signed out, never throw. The dead `avatarUrl` /
`displayName` fields (declared, never rendered) were dropped from the
control's view-model.

### Tests

16 control mocks rewritten to flat payloads plus a literal-payload
regression test; new `me.test.ts` (selector totality); new API contract
test pinning the `handle` field (connected / display-only paths). `pnpm
test` (104 + 539) and `pnpm run check` green.

### Still operator-side

The 6-check browser re-run (signed-out load, sign-in, landing without
error boundary, chip, clean console, refresh persistence) — no browser
in this environment.

## 17. Stage B closure — full onboarding flow + one-time tour (2026-10-09)

Fix commit `5b37ccf`. API redeploy `3a0f41f7` SUCCESS (migration 0002
applied at startup); web redeploy Ready, Production
(`pass-oy0it90lg`, aliased). `/health` modes unchanged; execution mock.

### Step 0 answers (abridged)

Seven code sites touched `/api/v1/me`; after the fix exactly two read
identity state and both go through `lib/me.ts` (`XIdentityControl`,
`XConnectedNotice`). `SettingsClient`, the guard, and the probes read
other flat fields or booleans only. `/app/onboarding/` was two files —
one presentational screen, always step 0, actions unwired (no props from
`page.tsx`). First-visit gating was partial (three pages). wagmi +
ConnectKit mounted in the root layout (`Providers`). No handoff existed.

### What shipped

- `OnboardingFlow`: `/me` as source of truth, first-incomplete-step
  start, real actions (OAuth nav, profile POST with slug validation,
  wallet-address link only, Ethos refresh that never blocks), Back
  navigation, wallet skip with Take warning, handoff
  ("You're set. Go find a Pass." → `/discover`, `/u/{slug}`). Profile row
  is the completion record — no new column. The hyperliquid step action
  was renamed ("Generate agent wallet" → "Link wallet account"): the old
  label promised Stage F work inside onboarding.
- `OnboardingGate` (single, layout-mounted) replaces the three per-page
  guards: profile-less → `/onboarding` from anywhere; signed-out on
  `/onboarding` → `/`; complete on `/onboarding` → `/discover`.
- D-022 tour: five `Dialog`-shelled steps (focus trap, Esc, aria from the
  existing overlay — no animation, so reduced-motion is trivially met),
  `profiles.tour_completed_at` + migration 0002, PATCH support,
  settings replay. Tour is explicitly not the Stage B gate.

### Tests

Flow 13, gate 6, tour 9 (incl. gate PATCH-and-hide), selector additions.
`pnpm test` (104 + 570) and every `check` phase green. One environment
note: the PGlite API tests need 120s timeouts — boots take 10s+ idle and
70s+ under load on this machine; 30s default flaked.

### Still operator-side

The 13-check incognito run (report §8). No browser in this environment.

## 18. Stage B final — authoring gate + connection truthfulness (2026-10-09)

Fix commit `b85f3e0`. API redeploy `1d9424c4` SUCCESS; web redeploy READY
(`pass-3w3ucobq9`, aliased). Live: signed-out `POST /passes` and `POST
passes/:publicId/refresh` both answer 401 AUTH_REQUIRED; `/health` modes
unchanged; execution mock.

### Bug 1 — session-without-identity could author

Disconnecting X keeps the PASS session, and the create form + API checked
only the session — an identity-less user could render and submit
`/passes/new`. Fixed on both sides: `POST /passes` now requires an X
identity (409 IDENTITY_NOT_CONNECTED, PRODUCT_PRD.md §4); the form checks
`isXConnected` (its PermissionBlock copy already said "connected X
identity"); the gate redirects signed-out visitors off `/passes/new` and
take routes to landing. Full API audit: every authenticated mutation
already resolved ownership from the session — locked by 19 tests — except
`POST passes/:publicId/refresh`, which mutated with no session at all and
is now gated (`POST /validate/pass` stays public: pure validation).

### Bug 2a — stale screens after disconnect (operator-found, new)

Settings kept reporting "connected" until F5; only the topbar re-read.
Fixed with a 20-line `me-events` bus: disconnect notifies, the four
`/me`-holding screens reload through their existing `reload()`.

### Bug 2b — linked vs live, honestly separated

Operator chose soft on both (recommended): X disconnect deletes only the
`x_connections` row (identity kept, D-018.6; reconnect re-attaches);
wallet disconnect stays browser-only (row kept, D-019.1). `/me`
`connections[x].connected` now means exactly one thing — live,
unexpired tokens held (comment in the handler). The browser-only wallet
session renders as its own line in Settings (`WalletSessionLine`); the
server cannot observe ConnectKit and does not pretend to. New
`DELETE /me/trading-accounts/:id` (ownership-checked, refuses accounts
with executions so D-008 history is never orphaned) gives PASS-side
unlink, which previously had no endpoint at all.

### Tests

New `pass-gate.test.ts` (26 API: 19 auth locks, identity 409/201,
refresh gate, unlink ×3, soft-disconnect, logout); web: create gate,
gate redirects, invalidation, wallet-session ×2. `pnpm test` root
14/130 green; web affected files 60+71 green (full web suite exceeds one
tool call on this machine — all touched areas run, untouched files
unchanged since their last green run). Tsc + eslint clean both sides.
PGlite suites refactored to one boot per file with raised timeouts after
parallel boots flaked under load.

### Still operator-side

The 8-step verification run (§5 of the brief) — no browser here.
