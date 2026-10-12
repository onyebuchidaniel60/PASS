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
