# PASS — Product Requirements Document

**Version:** 1.0 draft
**Status:** Source of truth
**Last reviewed:** 2026-10-03

## 1. Product summary

PASS is a social execution layer for Hyperliquid that turns a trader's trade plan into a shareable, stateful Pass that another trader can discover, evaluate, and independently execute.

**Positioning:**

> See a trade. Know the trader. Take the trade.

PASS connects four layers:

```text
X             -> discovery/distribution
Ethos         -> identity/reputation context
PASS          -> profiles + trade plans + Passes + social graph
Hyperliquid   -> market data + execution
```

## 2. Problem

Crypto traders frequently discover trade ideas socially, particularly on X, but execution is disconnected from the social context and the specific strategy behind a post. A user often has to manually translate a post into exchange parameters and decide whether the person behind the post is someone worth listening to.

PASS makes the trade itself a structured, shareable object while keeping execution under the Taker's control.

## 3. Product thesis

A specific trade is a better social primitive than a generic instruction to follow a trader.

PASS therefore optimizes for:

`discover -> understand -> decide -> execute`

not:

`follow -> automatically copy`

## 4. Goals

### MVP goals

1. A Trader can connect identity information and create a public PASS profile.
2. A Trader can create and publish a structured Pass.
3. A Pass has a shareable public URL.
4. A viewer can inspect the trader, reputation context, and trade plan without logging in.
5. A Taker can connect/authorize Hyperliquid execution and independently choose position size.
6. A Taker can execute the Pass on Hyperliquid.
7. PASS records and displays the resulting execution and lifecycle.
8. Traders can share Passes on X.
9. The Chrome extension can surface PASS context and Pass links on X.
10. The complete system is deployed and usable.

## 5. Non-goals

- automated copy trading;
- AI-generated trade recommendations;
- custody of user funds;
- managing users' master wallet private keys;
- multi-exchange execution in MVP;
- multi-chain execution in MVP;
- token/DAO economics;
- native mobile applications;
- in-app messaging/chat;
- advanced social feed ranking;
- advanced charting terminal;
- financial advice or guarantees.

## 6. Personas

### Trader

A Hyperliquid trader who already shares setups socially and wants a structured way to publish them.

Primary jobs:

- create a trade plan;
- publish a Pass;
- share on X;
- see who took the Pass;
- build a public trading identity.

### Taker

A trader discovering ideas through X or PASS who wants to take individual trades rather than automatically mirror a trader.

Primary jobs:

- inspect trader context;
- inspect reputation;
- inspect Pass details;
- choose position size;
- execute independently.

### Observer

A non-trading or not-yet-trading visitor who browses profiles and Passes.

## 7. Core vocabulary

- **PASS** — the product.
- **Pass** — an individual shareable trade object.
- **Trade Plan** — the structured strategy contained in a Pass.
- **Trader** — a user who publishes Passes.
- **Taker** — a user who executes a Pass.
- **Take Pass** — primary execution CTA.
- **Pass status** — the current lifecycle state of a Pass.

## 8. Core user journeys

### 8.1 Trader onboarding

```text
Landing
  -> Connect X / establish identity
  -> Create PASS profile
  -> Associate Hyperliquid trading identity
  -> Resolve Ethos reputation if available
  -> Trader profile ready
```

### 8.2 Create a Pass

```text
Dashboard
  -> Create Pass
  -> Asset
  -> Direction
  -> Entry type + entry
  -> TP / SL
  -> Leverage
  -> Thesis
  -> Expiry
  -> Preview
  -> Publish
  -> Share link / X
```

### 8.3 Take a Pass

```text
X or PASS discovery
  -> Open Pass
  -> inspect Trader
  -> inspect Ethos
  -> inspect trading context
  -> inspect Trade Plan
  -> Take Pass
  -> choose position size / execution parameters
  -> review
  -> authorize
  -> Hyperliquid order
  -> execution status
```

## 9. Pass data requirements

Required:

- asset;
- direction;
- entry type;
- entry price when limit-based;
- thesis;
- published timestamp;
- expiry/validity.

Optional:

- stop loss;
- take profit;
- leverage target;
- chart/image attachment;
- tags.

The Trader provides trade-plan parameters. The Taker controls their own notional/position size and execution authorization.

## 10. Pass state machine

```text
DRAFT
  |
  v
ACTIVE
  |
  +----> EXPIRED
  |
  +----> CANCELLED
  |
  +----> INVALIDATED
  |
  v
ENTRY_PENDING
  |
  v
OPEN
  |
  +----> TP_HIT
  |
  +----> SL_HIT
  |
  +----> MANUALLY_CLOSED
```

Implementation may represent `ACTIVE` and `ENTRY_PENDING` separately or combine them if the API contract is preserved. The displayed state must remain unambiguous.

## 11. Trader profile

Minimum public profile information:

- display name;
- X handle / identity where connected;
- avatar;
- bio;
- Ethos reputation context where available;
- published Pass count;
- completed Pass metrics;
- active Passes;
- link to full reputation profile;
- associated Hyperliquid identity when the Trader has opted to expose it.

## 12. Reputation model

Ethos is shown as external reputation context.

Display data may include:

- credibility score;
- reviews count;
- vouches count;
- human verification state where available;
- link to Ethos.

PASS must not combine Ethos reputation and trading performance into a single trust score.

## 13. Trading-performance model

Separate:

1. **Hyperliquid account statistics** — public/observable account-level trading context.
2. **PASS performance** — outcomes of Passes published through PASS.

Do not imply that account-level performance proves Pass-level performance.

## 14. Execution rules

Before execution PASS must validate:

- Pass exists and is active;
- Pass has not expired/cancelled/invalidated;
- asset is still supported;
- order parameters remain valid;
- user's account state can support the order;
- position sizing is valid;
- slippage rules are within the user's configured tolerance;
- TP/SL parameters are valid if requested.

If the Pass has materially changed since the viewer loaded it, require a fresh review.

## 15. Immutable history

Published Pass history is append-only from an audit perspective.

If a Trader changes a live Pass, store a Pass update event. Once an execution references a version, that historical version must remain reconstructable.

## 16. Sharing

A Pass receives a stable identifier and a shareable URL.

Preferred forms:

- human-readable: `/u/{traderSlug}` (D-019.3)
- immutable object path: `/p/{passId}`

The immutable ID is authoritative.

## 17. Chrome extension

The extension is part of the first build.

Its MVP purpose is X discovery/context:

- recognize X profiles/posts where PASS can resolve context;
- display lightweight PASS indicators;
- surface known Pass links;
- deep-link users into PASS.

The extension should not become a second trading terminal.

## 18. Landing-page messaging

Hero:

> See a trade. Know the trader. Take the trade.

Support:

> PASS turns Hyperliquid trade plans into shareable, executable links.

Primary CTA: `Explore Passes`
Secondary CTA: `Create a Pass`

## 19. MVP success criteria

The MVP is successful when all of these are demonstrably working:

- Trader creates Pass;
- Pass is public;
- Pass can be shared on X;
- viewer can understand who created it;
- viewer can inspect reputation context;
- viewer can understand the trade plan;
- Taker can choose size;
- Taker can review execution;
- Taker can authorize execution;
- Hyperliquid accepts the order;
- PASS records execution;
- Pass lifecycle updates accurately;
- extension can surface PASS context on X;
- production deployment is reachable and usable.

## 20. North-star metric

**Successfully Taken Passes**.

Secondary metrics:

- Pass views;
- Pass -> Take conversion;
- Take -> execution conversion;
- active Traders;
- active Takers;
- repeat Takers;
- Takers per Pass;
- completed Pass rate.

## 21. Design sequencing

Visual design is executed in the dedicated frontend design track, per `docs/DECISIONS.md` **D-017**.

The functional MVP success criteria in §19 are **unchanged** by this sequencing. Every criterion in §19 — Trader creates Pass, Pass is public, Taker chooses size, Taker reviews and authorizes execution, Hyperliquid accepts the order, PASS records execution, the lifecycle updates accurately, the extension surfaces PASS context, and production is reachable and usable — remains a requirement of the MVP exactly as written.

What changes is only **when** visual design happens. The one-shot build delivers functional surfaces with a usable but provisional UI; visual completeness is a deliverable of the frontend design track (`docs/IMPLEMENTATION_PLAN.md` Stage K, executed against `design/DESIGN.md` under `SKILL_FRONTEND_DESIGN.md`), not a gate on the one-shot build.

This is a sequencing decision only. It does not narrow MVP scope, and it does not permit any surface listed in §4 and §19 to be deferred.
