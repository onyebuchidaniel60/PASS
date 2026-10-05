# Deferred findings (`nice-to-fix-later` backlog)

Named, per `design/FRONTEND_IMPLEMENTATION_PLAN.md` §6.2 step 13 and
`SKILL_FRONTEND_DESIGN.md` §7.2 step 11. Logged by name rather than fixed, so
scope is not expanded. An entry leaves this list when it is fixed; the file
records that, it is not rewritten silently.

| ID | Screen | Finding | Category | Recorded in |
|---|---|---|---|---|
| D-1 | Executions (`/me/executions`) | Table is wrapped in `overflow-x-auto` with `min-w-[720px]`, a horizontal scroller. `design/DESIGN.md` §8.5 requires wide tables to become a stacked-card list below the tablet breakpoint and states they never become a horizontal scroller. | `design-violation` | [PHASE_00_tokens.md](./PHASE_00_tokens.md) §9 finding 4 |

## How an entry is closed

An entry is struck through with the commit that fixed it and the phase record
that verified it. It is not deleted: an empty list is indistinguishable from a
list that was never populated.
