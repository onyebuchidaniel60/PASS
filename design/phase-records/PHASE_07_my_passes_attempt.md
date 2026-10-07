# Stage K — Phase 07: My Passes attempt, not landed

Date 2026-10-06. **No commit.** Working tree left at the previous green state.

## What was attempted

§10.8 My Passes, replacing `/me/passes` in place, with `DataTable`, `StatRow`,
`formatPrice`, `formatRelative` and `shortAddress` built inline as the screen
pulled them. The screen implemented all five required states — unauthenticated,
loading, empty, populated, error — with auth reusing the `/api/v1/me` probe
Create Pass uses, and §10.8's rules encoded: counts not colour-coded, no row
striping, no horizontal scroller, takers figure stating its window.

## Why it was not landed

**16 of 17 tests passed.** The one failure was the *unauthorized* state test,
and it failed for the same reason the equivalent test failed on Pass detail two
sessions ago: **a rejected promise handed to a mocked client escapes this test
runner as an unhandled rejection**, failing the file rather than the assertion.
Five approaches were tried across this and previous sessions:

1. `mockRejectedValue`
2. `mockImplementation` returning `Promise.reject`
3. the same on a deferred `setTimeout` tick
4. a synchronous `throw` inside the async loader
5. an explicit async `act()` wrapper
6. a single suite-wide pre-caught `UNAUTH` promise

All fail the file. This is a **harness limitation, not a product defect**, and it
is now the single largest thing standing between this project and finishing the
remaining screens.

## One real defect was found and fixed before the revert

`formatRelative` reported a **future** timestamp as `just now`. A negative hour
count fell into the `h < 1` branch, so an expiry a week out would read as
already arrived. Corrected to render a distance forward (`in 3d`) and to treat
only −24h…0 as `just now`. Worth keeping regardless of this screen.

## Decision

The screen was reverted rather than committed with a failing suite. A green
repository with 13 working screens is more useful than a red one with 14, and the
state coverage that could not be executed would have been silently lost.

## The fix that would unblock the remaining screens

Extract the authenticated data-loading from the presentational component, as
already identified for Pass detail: a hook that returns
`{ state, data, error }` and a pure view that renders from it. Then the
unauthorized and error branches can be rendered directly, with no rejected
promise and no `act()` involvement. This is a small refactor that unblocks
§10.8, §10.9, §10.10 and §10.11 at once, all of which are authenticated screens
with the same shape.

**Recommendation:** do that refactor FIRST next session, before starting
Executions. Attempting §10.9 before it will hit the identical wall.

## Screens still provisional

§10.8 My Passes · §10.9 Executions · §10.10 Profile and connections ·
§10.11 Onboarding. All four routes return HTTP 200 with the provisional Stage J
UI, so a status check will not reveal that.

## Status

**OPEN.**
