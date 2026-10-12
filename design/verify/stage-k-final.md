# Stage K final — frontend polish (PARTIAL)

**Date:** 2026-10-12
**Status: PARTIAL.** Baseline audit complete; one real fix shipped and verified
live; motion and accessibility inventoried clean with named residuals;
remaining screens deferred (need authenticated fixtures + screenshots, and the
submission window outranks polish — Stage K is optional for submission).
**Deployed:** `dpl_8sDx4jopCm9JcH4ig3HtHheBUHRx`
(`https://pass-9flf5tf30-uhhh2.vercel.app`, aliased to
https://pass-web-dun.vercel.app). Build from tree with Stage K commits.
**No backend, API, auth, execution, provider-mode, or SIMULATED-label change.
No new UI framework. No out-of-token values. Full web suite 651/651 green.**

## Per-screen second-pass results

| # | Screen | Baseline divergences | Fix | Second pass |
|---|---|---|---|---|
| 1 | Landing | 1a eyebrow 03 `Read more` vs `03 THE NETWORK` (design-violation) | Fixed, commit `2670f21` | CLEAN — deployed eyebrow reads `\The network\\03\` (Playwright text assertion); harness 0/0/0/0 both viewports |
| 2 | Pass detail | none asserted; harness-selector residual (CTA MISSING on expired pass = correct) | none | CLEAN harness; visual-density review deferred |
| 3 | Discover | 10px badges + 3.8:1 card blend (deferred measurement) | none | CLEAN harness; element-ID follow-up deferred |
| 4 | Take flow | 4a (withdrawn — dead data) → 4b display-headline vs STEP_TITLE (deferred design decision) | reverted `fbb3869` | CLEAN harness; funnel untouched by design |
| 5 | Trader profile | none asserted | none | CLEAN harness; separation-rule screenshot deferred |
| 6 | Create + Edit | none asserted (auth-gated) | none | CLEAN harness signed-out; interaction walk deferred |
| 7 | My Passes | none asserted (auth-gated) | none | CLEAN harness signed-out; consistency reading deferred |
| 8 | Executions | none asserted (auth-gated) | none | CLEAN harness signed-out; cross-surface figures deferred |
| 9 | Onboarding | none asserted (auth-gated) | none | CLEAN harness; fresh-account walk deferred |
| 10 | Settings | none asserted; 4×401 signed-out probe = expected | none | CLEAN harness; prop-wiring residual untouched |
| 11 | Stale interstitial | none asserted (needs versioned fixture) | none | deferred |
| 12 | Error / 404 | `/gallery` 404 verified both viewports | none | CLEAN |
| 13 | OG preview | acquitted by code reading (§10.14 shape, compact-only-here, no private data) | none | — |

Skills applied: Impeccable `clarify` (1a copy), `detect` (baseline);
Emil decision-framework + <300ms/ease-out/reduced-motion (motion audit);
Taste scoped OUT for dashboard/data/funnel screens per its own §0;
Apple translucent-materials REJECTED per DESIGN §12.1. DESIGN.md won every
conflict; DESIGN.md NOT edited.

## Motion audit (Task 4) — kept vs removed

Kept, each with purpose: signal reveal (orient, 420ms once, reduced-motion
final-state); button/chip transitions + press scale (confirm, 120/180ms,
`--ease-standard`); sparkline draw (explain, 420ms once, reduced-motion
present); live pulse (explain, 2000ms ×2 then rest per §14.7 — exceeds the
generic 300ms cap but DESIGN-mandated for its surface; reduced-motion off);
status cross-fade (explain, 180ms). Zero `ease-in` on enter (all
`--ease-standard`/linear). **Removed: nothing** — inventory found no
decorative, looping, marquee, shimmer, bounce, or parallax motion. No haptics.

## Accessibility (Task 5) — verified vs residual

Verified: harness 0 overflow/overlap/target-size/clipped-text at 375×812 and
1280×800 on all 14 routes (post-deploy re-run); icon-only controls carry
accessible names (reticle, live dot, icon buttons — test-asserted); sparkline
exposes `role="img"` + `aria-label`; decorative layers (wash, grain,
watermark, brackets, delimiters) `aria-hidden`; headlines carry spaced
`aria-label`s; reduced-motion paths token-driven + per-component with
final-state retention (test-asserted); above-fold status/asset/metrics
measured visible on Pass detail.
Residuals (deferred, not fixed blindly per token-layer rule): 3.8:1 card-text
blend element ID + recomputation; 1.1:1 watermark element confirmation
(consistent with decorative §14.1 ghost, aria-hidden); 10px badge
DESIGN-internal tension (§3.4 floor vs §14.6 badge spec) proposed as
evolution-log entry.

## Residuals with reason

1. Screens 2–11 visual-density/hierarchy screenshot review — needs
   authenticated fixtures + real-browser screenshots; submission window
   outranks.
2. How-it-works headline copy vs §14.4 table (accent `promise.`, avoids
   duplicate `Pass`) — proposed DESIGN evolution entry, not a silent amend.
3. Take 4b (display headline vs STEP_TITLE) — design decision with funnel
   risk, not polish.
4. Contrast follow-ups (3.8:1 blend, 1.1:1 watermark, 10px badges).
5. Harness `above-fold.cta` selector gap (cosmetic, nice-to-fix-later).
6. Vendored skill dirs (`.agents/`, `.claude/`, `.codex/`, `agent/`,
   incl. 2× 19MB detector binaries) left untracked; reproducible via
   `skills-lock.json` + documented install commands.

## Evolution-log entry (for `design/phase-records/stage-k.md`)

- Worked: DESIGN-wins authority made detector triage fast; token rule
  prevented blind fixes; per-screen commits kept the dead-data error
  revertible in one commit; deployed-URL second pass caught the
  HERO_LINES.take caller error that unit tests could not (data change with
  no caller is invisible to DOM tests).
- Didn't: assuming Take used `heroLines("take")` without tracing the
  caller — plan §4.1 exists for exactly this; agent-as-user pass caught it.
- Gaps discovered: §3.4 12px floor vs §14.6 10px badges; §14.4 Take-row
  hero vs §10.6 step-title practice; How-it-works accent-word rationale.
- Proposed rule: any copy-data change must cite its rendered caller in the
  commit message.
