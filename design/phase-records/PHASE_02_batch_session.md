# Stage K — Phase 02: batch session (primitives + 3 screens)

Date 2026-10-06. Commits `3605539`, `5a1ae5c`, `5abe6c7`.
Author: coding agent, per `AGENTS.md`.

## Capability

No browser automation. Every item is "built, not visually verified". Per
`SKILL_FRONTEND_DESIGN.md` §7.6 this is stated once here and the phase stays
open until an operator completes the browser pass.

## Delivered

| Item | Detail | Tests |
|---|---|---|
| Wave 3/4 primitives | `StatusChip` (all 10 §11.7 states), `Timestamp`, `LiveOrStale`, `Address`, `DirectionBadge`, `Pnl`, `StatBlock`, `ReputationBlock`, `PerformanceBlock`, `HandleBlock`, `LoadingBlock`, `EmptyBlock`, `ErrorBlock`, `UnavailableBlock`, `RejectedBlock` | 27 |
| Wave 5 `Dialog` + §10.7 `StaleInterstitial` | focus trap, Escape, focus restore, overlay tier only | 7 |
| §10.3 Pass detail | real pipeline, 5 lifecycle states, coordinate grid, mandated Rule between performance and reputation | 21 |
| §10.4 Trader profile | real pipeline, mandatory Rule, Active Passes, empty state, `/u/{slug}` | 13 |

Cumulative: 27 + 24 = 51 components, 3 screens, **231 tests** (186 web, 45 package).

## Design document read

`design/DESIGN.md` §2.5, §3, §5.3–§5.4, §7.3, §9.5–§9.8, §10.3, §10.4, §10.7,
§11.2–§11.8, §12.3, §12.4; `docs/UX_SPEC.md` §5, §6, §9, §11.

## Findings

| # | Observed | Category | Disposition |
|---|---|---|---|
| 1 | `Toggle` never applied its `id`; lint flagged the unused binding | `accessibility` | Fixed — wired to the DOM |
| 2 | `aria-checked` passed as a string on the toggle track; typecheck rejected it | `accessibility` | Fixed — boolean |
| 3 | PnL-minus assertion used a hyphen; §11.4 mandates U+2212 | `design-violation` | Fixed — test asserts U+2212 |
| 4 | Ethos disclaimer assertion matched two elements (the caption also says "community sentiment") | `anti-pattern` | Fixed — assertion made specific, so it now actually tests the disclaimer |
| 5 | `PassDetailClient` imported `StatBlock` unused; lint | `anti-pattern` | Fixed |
| 6 | `components.css` wrote `1px solid var(--color-accent-edge)` directly; token scan | `anti-pattern` | Fixed — used the existing `--border-accent-edge` token |
| 7 | A colour literal in a test assertion was itself a scan violation | `anti-pattern` | Fixed — replaced with a transparent pattern, no literal |
| 8 | `vi.mock` factory referenced a later `const`, hitting the TDZ | `anti-pattern` | Fixed — `vi.hoisted` |
| 9 | Trader-profile renders resolved outside `act`, so every assertion saw the loading branch | `anti-pattern` | Fixed — async `act` boundary |

## Open item — recorded, not hidden

**The network-failure → error-state transition on Pass detail is NOT covered.**
The error branch is implemented (`ErrorBlock` + `Retry`) and `ErrorBlock`'s own
contract is tested in the Wave 3 suite, but the transition could not be
exercised: a rejected `clientGet` escapes this runner as an unhandled rejection.
Four approaches were attempted and all failed the suite before the state could be
observed — immediate rejection, rejection on a `setTimeout` tick, a synchronous
throw inside the async loader, and an explicit async `act` wrapper.

Closing it properly means extracting the presentational states from the
data-fetching wrapper so the error branch renders directly. That is a real
refactor, not a test tweak. Left as the next session's first task rather than
asserted away.

## Measurements

**Not possible.** No browser automation, so none of §4.3 was measured: no target
sizes, no horizontal-overflow check, no above-the-fold position assertions, no
rendered contrast, no reduced-motion rendering. Every claim above is about the
DOM contract asserted in tests, not about rendered appearance.

## Design amendments

**None.** `design/DESIGN.md` was not edited this phase.

## Design gaps

None new this phase. G-1 through G-16 stand as recorded in `design/README.md`.
G-2 (no wordmark) still binds: the shell sets `PASS` as type only and no logo or
favicon was improvised.

## Status

**OPEN** — gated on the operator browser pass.
