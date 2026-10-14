# Stage K.2 — reference-driven redesign (skills applied by hand)

OpenCode cannot invoke Claude Code slash commands; every skill below was read
as reference text and applied manually. DESIGN.md wins all conflicts.

## Screen 1 — Landing (`/`)

Reference: `reference (6).png` (type scale + colour discipline: enormous
display headline with a white→ember→white gradient sweep, small body copy
in a narrow column, chamfered chips) + mobile before-shot.

Skill rules applied (written before code changed):
- Taste §4.1/§4.7: display headlines carry the page at large scale with
  tight tracking; multi-column layouts collapse to an explicit single
  column below 768px (never squeezed stubs).
- Emil (emil-design-eng): motion untouched — signal reveal already
  orient/180–420ms/ease-out with reduced-motion final-state; no new motion.
- DESIGN §14.4 (overrides Taste where Taste is generic): gradient variant
  permitted ONLY on the Landing hero; one ember word per line stays.

3 divergences (only 2 genuine — recorded honestly):
1. Hero headline renders flat white (+1 ember word). Reference (6) sweeps
   a gradient across the headline; DESIGN §14.4 builds exactly that
   variant and no screen enables it. → pass `gradient` to the landing
   hero `DisplayHeadline` (one prop; token values already exist).
2. Mobile (375px) loop strip squeezes 5 CoordinatePairs into unreadable
   `X… P… t… t… H…` stubs (`repeat(auto-fit, minmax(0, 1fr))` at all
   widths). Information loss, not graceful truncation. → single-column
   base, 5-across restored at ≥768px (existing breakpoint convention).
3. Sought third: lede measure, CTA pairing, step-grid density, chip
   treatment all verified against DESIGN/tokens — no genuine third
   divergence found; not invented.

Shots: `screenshots/stage-k2/landing-before-{desktop,mobile}.png` (captured
pre-change from production) → `landing-after-{desktop,mobile}.png`.
Harness post-deploy: clean both viewports. Tests: landing 40/40 +
reference 56/56 green.

## Screen 2 — Pass detail (`/p/{id}`)

Reference: `(12).png` (card-row hierarchy, headline figure + delta +
timestamp) + `(10).png` (status as mono text + colour) + before-shots
(desktop viewed, mobile 375 viewed).

Skill rules applied:
- Taste §4.9/§4.5: full data fidelity over truncation aesthetics — a value
  the user came for must survive the viewport, not ellipsis into ambiguity.
- Apple Design: information density must not cost legibility; every data
  row stays readable at 375px.
- Emil: no motion on this screen needed work; untouched.

Divergences (1 genuine — stated honestly, not padded to 3):
1. Market snapshot "Observed" timestamp renders `2026-10-12 02:23…` on
   375px — the metric-dd ellipsis cuts the `UTC` zone, violating §11.5
   (absolute form with zone stated). Timestamps are not figures, so
   §14.15 rule 2 (figures never wrap) does not protect this truncation.
   → row modifier `pass-card-metric--wrap` on the Observed row; dd may
   wrap there only. No token values added (all existing).
2. Considered and REJECTED: forcing §14.5's literal 5/3/2/1 metric-card
   cardinality (auto-fit fluid grid shows 5-across at 1280). The fluid
   grid uses space better than a 3+2 orphan wrap; changing it would
   degrade the layout to satisfy the letter against the intent. Recorded,
   not changed.
3. Sought third: thesis measure (capped 62ch ✓), timeline timestamps
   (full form ✓), status chip, metric units on baseline — all compliant.
   No third divergence; not invented.

Shots: `pass-detail-before-*` (pre-existing) → `pass-detail-after-*`
(deployed check). Tests: passDetail 47 + reference 56 green.

## Screen 3 — Take flow (`/passes/{id}/take`)

Reference: `(4).png` (numbered process density: every step panel carries
its number) + take before-shots (desktop viewed; step-1 funnel verified
against §10.6: empty size field, stepper + range, context strip, single
accent forward action).

Skill rules applied:
- Impeccable structure: one shared header serves 4 steps — fix the header
  once, never per-step branches.
- Taste: mono step text stays (no novelty stepper); numbering is content.
- DESIGN §14.3 table (binding): Take flow sections are
  `01 SIZE, 02 CONSENT, 03 REVIEW, 04 CONFIRM`.

Divergences (1 genuine + 1 noted):
1. Step header hand-rolled a bare `// … Take a Pass` span with NO number,
   against the §14.3 table. → shared header renders the real
   `NumberedEyebrow` (`STEP_EYEBROW[step]`, `number={step}`); `STEP n / 4`
   mono line and `STEP_TITLE` h1 untouched (both test-pinned).
2. Sought second/third (context chips, stepper bounds, Review-order
   ration, Back-to-Pass ghost, consent-first Authorize, SIMULATED
   receipt): all compliant via takeFlow.test (38 tests) — not re-styled
   for motion's sake.

Shots: `take-before-*` → `take-after-*` (deployed check).
