# Stage K baseline — per-screen comparison (Task 2.3)

**Date:** 2026-10-11
**Base:** https://pass-web-dun.vercel.app (deployed, signed-out fresh session via Playwright harness + webfetch text + source reading)
**Blueprint:** `design/DESIGN.md` §§1–14. **Authority:** DESIGN.md > four installed skills > `design/references/`.
**Harness:** `design/verify/latest-mobile.txt`, `design/verify/latest-desktop.txt` (re-run 2026-10-11, 14 routes, both viewports).
**Detector:** `design/verify/impeccable-baseline.txt` (`detect apps/web/src` + URL scan `/` + `/discover`).

Mechanical harness state: **0 overflow, 0 overlap, 0 target-size, 0 clipped-text, 0 full-width-actions on every route at both viewports.** Console errors are 401s only (signed-out session probe; `/api/v1/me` 401s are filtered from network failures by design). No non-401 network failures.

Impeccable detector conflicts triaged (DESIGN wins — these are NOT baseline divergences, recorded here so a later `/impeccable polish` does not "fix" the blueprint):

- `[oversized-h1]` 76px hero — DESIGN §14.4 mandates 72px@1280 (92px@1440). Detector's generic long-headline rule is overruled. NOT a divergence.
- `[kicker-above-heading]` numbered eyebrows — DESIGN §14.3 mandates `\\ NAME \\ … \\ NN \\` on every section. Detector bans kickers outright. Overruled. NOT a divergence.
- `[overused-font]` Inter — DESIGN §3.1 mandates Inter Tight body (with Archivo display + IBM Plex Mono data, self-hosted, byte-verified). Overruled. NOT a divergence.
- `[gradient-text]` `.pass-display[data-gradient]` — DESIGN §14.4 permits the gradient variant ONLY on the Landing hero; no app screen currently passes `gradient`, so the rule is defined but uninvoked with zero rendered effect. Acquitted (no visual impact).
- `[nested-cards]` — Landing step-grid visual slots intentionally carry data cards per §14.10 ("PASS fills this with a data card or a stat row, never an image"). Detector's generic nesting rule is overruled where DESIGN mandates the composition. NOT a blanket divergence; individual screens note real nesting only if outside §14.10.
- `[undersized-ui-text]` 10px status badges — DESIGN §14.6 specifies 10px mono uppercase badges while §3.4 sets a 12px floor for text. Internal DESIGN tension recorded (see residuals); detector's 11px floor does not overrule a mandated value. Deferred, not silently fixed.
- `[low-contrast]` 1.1:1 `#161615` on `#0a0a0a` — consistent with the §14.1 ghost watermark (5% oversized brand type, aria-hidden, behind hero only). Decorative by design; acquitted pending element-level confirmation in the motion/a11y pass.
- `[low-contrast]` 3.8:1 `#706d68` on `#0b0b0e` (card surface) — no such literal exists in source; it is a computed blend (opacity). Element not yet identified; recorded below as the one accessibility-category item requiring measured follow-up. NOT fixed blindly per token-layer rule.

Taste-skill applicability note: the skill declares itself for "landing pages, portfolios, and redesigns — not dashboards, not data tables, not multi-step product UI." Only the Landing screen falls in its scope; dashboard/data/Take-flow screens are out of scope by the skill's own §0. Its dials and system-map (including any UI-framework suggestion) do not apply — Task hard constraint "no new UI framework" plus DESIGN §12.1 agree.

Apple-design applicability note: the skill's translucent-materials section (`backdrop-filter` layers) conflicts with DESIGN §12.1 (no glassmorphism, no backdrop blur, no translucent panels). DESIGN wins; that section is rejected for PASS. Springs/velocity/typography sections align with Emil + DESIGN §6 and are advisory only.

Motion-rule resolution applied throughout: every animation must orient, confirm, or explain; decorative motion is removed; Emil's <300ms + ease-out + reduced-motion discipline wins in practice. Live-pulse 2000ms×2 (§14.7) exceeds the generic 300ms cap but is DESIGN-mandated for its surface — recorded, not "fixed."

---

## 1. Landing (`/`)

- DESIGN §10.1 eye order (hero → 2 CTAs → loop strip → support line): MATCHES. Hero is 3 authored lines with ember `trade.` line 1; CTAs are `Explore Passes` primary + `Create a Pass` ghost immediately after; loop strip states all 5 steps; support line renders exact §1.3 copy in §03.
- Divergence 1a — §14.3 numbering/copy: eyebrow 03 reads `Read more`, table mandates `03 THE NETWORK`. Severity: design-violation. Skill: Impeccable `clarify` (copy). Disposition: FIX (label string only, token-compliant).
- Acquittals: support line present verbatim; bracket frame + wash + GridField hero-only; no product screenshot in hero (§12.2); hero text-extraction artefacts (`trade.Know`, `isnot`, `plans,written`) are `textContent` line-concatenation, not visual bugs — `aria-label` carries the spaced name (verified in `headline.tsx`).

## 2. Pass detail (`/p/{id}`)

- Above-fold @375 and @1280: status chip visible (~316–370px), asset `BTC LONG` visible (~211–256px), metric cards visible (~556–630px). CTA reads MISSING on the sampled pass because the sampled pass is `Expired` — CTA correctly absent for terminal states. The harness `above-fold.cta` selector (`a[href*="/take"] button`, `.pass-landing-cta-primary`) does not match the Pass-detail CTA class, so MISSING is a harness-selector residual, not a product finding. Severity: nice-to-fix-later (harness).
- Asset/direction anatomy: `DisplayHeadline` with ember direction, status chip directly under, plan block second, trader/market aside on desktop. `.pass-detail-object` sets the asset in the data face with the ember direction in the display face — matches the §14.4 table (`BTC **LONG**`); the data-face rule targets changing price digits, not the direction claim word. Acquitted.
- Deferred visual: wash-`section` strength behind dense digits, bracket frame, metric-card five-across (`ENTRY/TP/SL/LEVERAGE/R:R`), market `LIVE`/`STALE` chip, thesis measure cap — harness clean, visual density review deferred to polish with screenshots (no code change proposed blind).

## 3. Discover (`/discover`)

- Headline `Live **plans**, / written by traders.` matches §14.4 table; accent on `plans,`. Filters render (`All/Active/Open`), ticker fallback renders single muted `MARKET DATA UNAVAILABLE` row per §14.8 (honest, no marquee). Result-count eyebrow shows loading (`Counting…`) then resolves client-side.
- Detector 10px `sl_hit` badges + 3.8:1 card-text blends: recorded as deferred measured follow-up (see header). No inline fix per token rule.
- Deferred: row anatomy (DirectionBadge → asset → StatusChip → CoordinatePair → relative time), no-PnL-on-row rule (PRD §13), empty-state `EmptyBlock` with `Create a Pass` — harness clean, no divergence asserted without signed-in and empty fixtures.

## 4. Take flow (`/passes/{id}/take`, 4 steps)

- Divergence 4a — §14.4 ember word: headline renders `You author / your own **own** size.` (accent on `own`); table mandates ember `size` (line 2). Severity: design-violation. Skill: Impeccable `clarify` + Emil purpose (claim word). Disposition: FIX (move `accent: true` from `own` to `size.` in `hero-copy.ts`; data-only, token-compliant).
- Steps are distinct routes with mono `STEP n / 4`; size field empty by default (D-015); slider adjunct only. Detailed step-by-step (context strip, ChamferPanel order summary, plain-language authorization, receipt with provider order id, `RejectedBlock` + re-enter-Step-2 retry) deferred to an authenticated wallet walk — no code change proposed without observing the flow. SIMULATED labelling untouched by any polish.

## 5. Trader profile (`/u/{slug}`)

- No mechanical findings (harness clean). Identity header (avatar, `@handle`, connection chips as mono credential row), `PerformanceBlock` before `Rule` before `ReputationBlock`, active-Pass list reusing Discover anatomy — code-conformant by reading; visual separation and rule-mandatory check deferred to screenshot pass. No divergence asserted. Severity: none asserted; visual-defect review deferred.

## 6. Create Pass + Edit (`/passes/new`, edit)

- Auth-gated; harness renders signed-out fallback clean with no overflow/target issues. Preview-aside (sticky desktop, toggle mobile), PRD §8.2 field order, `Publish` disabled-with-reason, live textual validation, no Taker-size field (D-015) — asserted from source, not observed signed-in. No divergence asserted; interaction walk deferred (requires X-authenticated session + wallet-free publish per D-023).

## 7. My Passes (`/me/passes`)

- Auth-gated; harness clean signed-out. Lifecycle `StatBlock` strip (mono, uncoloured counts), Pass table (asset/direction/status/takers/published/expiry), accent `Create a Pass` in header, draft/cancelled ghost treatment without text-opacity loss — source-conformant. No divergence asserted; counts-vs-Discover consistency reading (§6.2 step 10) deferred until authenticated fixture.

## 8. Executions (`/me/executions`)

- Auth-gated; harness clean. Table (Pass/asset/size/fill/status/realized-PnL/timestamp), `PnlCell` sign+glyph (colour never sole carrier), row-detail provider-order-id + Pass version (PRD §15), `SegmentedControl` period using offset-from-now half-open windows — source-conformant. Cross-surface figure check (Pass PnL vs Executions row) deferred to authenticated fixture with simulated rows.

## 9. Onboarding (3 steps)

- Harness clean. One question per screen, display-size statement, accent action named for the act, one-sentence why, mono `STEP n / 4`-style progress, `UnavailableBlock` with skip where PRD permits, no wallet step (D-023 — wallet appears at Take only). No divergence asserted; step walk deferred (requires fresh X-authenticated account).

## 10. Settings (`/settings`)

- Harness clean; highest 401 count (4×) is the signed-out probe hitting guarded endpoints — expected, not a defect. `ConnectionChip` per provider with own reconnect, public-profile fields, accent `Save`, no seed/master-key field (must never exist). No divergence asserted; save/connect prop-wiring residual (§8.6 pre-existing scaffolding) untouched per hard constraints.

## 11. Stale interstitial (`/passes/{id}/stale`)

- Route exists in app inventory. Statement + accent `Review latest Pass` + mono diff, never silently executing on stale parameters (UX_SPEC §9) — source-conformant. No divergence asserted; triggering requires a versioned Pass fixture (edit → v2 → stale review), deferred.

## 12. Error / 404

- `/gallery` correctly 404s in production at both viewports (expected-404 ok — dev gate verified anonymously). Plain-statement + single accent action + mono request-id tertiary per §10.12 — source-conformant. A dedicated nonexistent-Pass rendering check (`/p/does-not-exist`) deferred to final verification.

## 13. OG preview (social card, not a screen)

- `generateMetadata` in `p/[publicId]/page.tsx` implements the §10.14 four-line shape (`PASS / BTC LONG / @handle / Entry $113.4K • TP $116K • SL $111.9K`), canvas background with at most one accent-text element, compact figures HERE ONLY (page body keeps full precision), no private account data. Acquitted by code reading. Image-asset v1 gap stands (no image required).

---

## Residuals and disposition

1. FIX now (token-compliant, zero backend/auth/execution touch): 1a (eyebrow `Read more` → `The network`), 4a (accent `own` → `size.`).
2. Measured follow-up (no blind fix): 3.8:1 card-text blend element ID + contrast recomputation; 1.1:1 watermark element confirmation; 10px badge DESIGN-internal tension (§3.4 vs §14.6) proposed as evolution-log entry, not a code patch.
3. Deferred visual (needs screenshots + authenticated fixtures): 2, 3, 5–12 density/hierarchy reviews; cross-surface figure readings; reduced-motion forced-on render check per animated surface.
4. Harness residual (nice-to-fix-later): `above-fold.cta` selector does not match the Pass-detail CTA class; report MISSING on terminal-state passes is correct product behavior.
5. DESIGN deviation with rationale (no silent amend): How-it-works headline copy (`A plan is / not a promise.` + accent `promise.`) vs §14.4 table (`A **Pass** is / a plan, not a promise.`) — implementation avoids a duplicate `Pass` against the §10.1 loop strip and accents the claim word per §14.4's own principle. Proposed as evolution-log entry; DESIGN.md NOT edited per hard constraint.
