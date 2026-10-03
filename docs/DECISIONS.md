# PASS — Decision Log

## D-001 — Product name

**Decision:** PASS.

**Rationale:** The core action is passing a specific trade from Trader to Taker. The language supports a strong interaction model: create a Pass, share a Pass, take a Pass.

## D-002 — Core object

**Decision:** Pass.

A Pass is a shareable, stateful representation of a Trader's trade plan.

## D-003 — Product category

**Decision:** Social execution layer / social trading infrastructure for Hyperliquid.

Do not position the MVP as a generic copy-trading platform.

## D-004 — Execution model

**Decision:** Non-custodial, user-authorized Hyperliquid execution.

Takers independently choose position size and authorize their own trade.

## D-005 — Hyperliquid signing model

**Decision:** Use Hyperliquid API/agent wallets where appropriate for seamless repeat execution. Keep the agent private key client-controlled for the MVP and do not store it in the PASS backend.

This is a PASS security/product decision layered on top of Hyperliquid's documented API-wallet architecture.

## D-006 — X role

**Decision:** X is discovery, identity, and distribution, not a replacement for the PASS application.

## D-007 — Ethos role

**Decision:** Ethos is reputation context.

Never merge Ethos reputation and trading performance into a single trust score or ranking.

## D-008 — Pass history

**Decision:** Publish/updates/execution lifecycle is auditable. Executions reference exact Pass versions.

## D-009 — MVP extension

**Decision:** Chrome extension is part of the first one-shot build.

It surfaces PASS context on X and hands off to the PASS web application. It does not sign or execute trades.

## D-010 — One-shot implementation

**Decision:** Build the complete product in one implementation pass before iterative correction.

The first pass includes:

- web app;
- backend;
- database;
- X;
- Ethos;
- Hyperliquid;
- execution;
- Pass lifecycle;
- analytics;
- Chrome extension;
- deployment.

## D-011 — Deployment

**Decision:** First build includes deployment, with the web application on Vercel and backend/database on suitable managed infrastructure.

## D-012 — Iteration methodology

**Decision:** After first deployment, iterate based on real usage and observed UX/integration gaps.

`deploy -> inspect -> fix -> redeploy -> repeat`

## D-013 — Scope exclusions

**Decision:** No AI trading, automated copy trading, token, DAO, multi-exchange execution, or multi-chain execution in MVP.

## D-014 — Performance separation

**Decision:** PASS performance and Hyperliquid account performance remain separate data categories.

## D-015 — Position sizing

**Decision:** The Taker selects their own absolute position size. A Trader's size may be displayed as contextual information but is not the default source of the Taker's order size.

## D-016 — Repository default branch

**Decision:** The repository's default branch is `main`.

`gh-pages` is retired as the default. All work, CI configuration, and
deployment pipelines assume `main` unless a future decision states otherwise.
The coding agent must verify the current default branch
(`git remote show origin`) before any branch operation rather than assuming it.

## D-017 — Frontend design track begins after the one-shot build

**Decision:** The frontend design track defined by `SKILL_FRONTEND_DESIGN.md`
begins **after** the one-shot product build is deployed and inspectable. It is
part of the iteration loop, not part of the one-shot build itself.

**Implications:**

1. The one-shot build delivers functional surfaces with a usable but
   provisional UI. It is not required to be design-complete.
2. The one-shot build's completion criteria in `docs/IMPLEMENTATION_PLAN.md`
   §6 and `AI_HANDOFF.md` remain in force, but "visually complete" is removed
   from the one-shot gate and moved to the frontend track.
3. The frontend track requires three companion assets, committed in this same
   preparation step:
   - `design/DESIGN.md`
   - `design/FRONTEND_IMPLEMENTATION_PLAN.md`
   - `design/references/`
4. `SKILL_FRONTEND_DESIGN.md` at the repository root governs all frontend work
   and is referenced from `AGENTS.md`.
5. The frontend track's per-phase verification (agent-as-user pass, deployed
   URL, mobile and desktop viewports) is required before any screen is called
   done.
