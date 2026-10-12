# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are crypto traders on Hyperliquid who act in two roles:

- **Trader (author):** turns a specific Hyperliquid trade plan into a shareable, stateful Pass. Creates, publishes, shares via X, monitors outcome.
- **Taker (follower):** discovers a Pass (via X link, Discover, or trader profile), evaluates the trader and the plan, independently chooses their own position size, and authorizes their own Hyperliquid execution. The Taker is the author of their own execution.

Secondary audience: signed-out visitors arriving from an X link who must be able to open a Pass (`/p/{id}`) and a trader profile (`/u/{slug}`) without signing in.

## Product Purpose

PASS is a social execution layer for Hyperliquid. It turns a trader's trade plan into a shareable, executable Pass that another trader can discover, evaluate, and independently take.

Core phrase (PRD §18, UX_SPEC §4): **See a trade. Know the trader. Take the trade.**

Support line: **PASS turns Hyperliquid trade plans into shareable, executable links.**

Success means a user arriving from X can open a Pass, inspect the trader, inspect Ethos context, inspect the trade plan, choose their own size, review current market and order parameters, authorize, execute on Hyperliquid, and see execution status — without PASS ever holding custody or signing keys.

## Positioning

A Pass is a specific trader-authored trade plan, not a generic copy-trading subscription. PASS is not a copy-trading system:

- The Taker independently chooses position size; it is never pre-filled from the Trader's size (D-015).
- Every execution is explicitly confirmed by the Taker.
- The backend relays signed Hyperliquid actions; it never holds signing keys (D-018.9).
- X is discovery, identity, and distribution. Ethos is reputation context, never merged with performance into a trust score (D-007). Hyperliquid is market data and execution venue.

A neighboring product that auto-copies trades, generates trades with AI, holds funds, or synthesizes a trust score could not truthfully claim to be PASS.

## Operating Context

Core workflows (PRD §8):

1. Trader: connect X identity → create Pass → publish (`/p/{publicId}`) → share on X → monitor execution and outcome.
2. Taker: open Pass → inspect trader → inspect Ethos context → inspect trade plan (entry, TP, SL, leverage, expiry, thesis) → choose own size → review current market and order parameters → authorize (wallet/agent connect at Take time only) → execute on Hyperliquid → see receipt and execution status.
3. Extension: load on X → recognize relevant trader or post → show one line of PASS context → `View Pass` handoff to the web app. The extension does not trade, chart, or execute.

Identity model (D-023, D-024): X is the only identity; wallet is execution-only and connects lazily at Take. X disconnect terminates the PASS session. There is no signed-in state without an X connection. Public artifacts (`/p/{id}`, `/u/{slug}`) render to signed-out viewers.

Execution model (D-021, D-025): Hyperliquid reads and execution are separately gated (`hyperliquidReads: live`, `hyperliquidExecution: mock` until a funded account lands). Agent/API wallet keys are client-held signers; account reads use the master/subaccount address. Pass history is append-only (`pass_versions` + `pass_events`); a stale Pass never executes without fresh review.

## Capabilities and Constraints

Confirmed functionality: responsive web app; X-authenticated onboarding and profile; Pass create, edit (versioned), publish, cancel; public Pass page; trader profile with separate reputation and performance blocks; discovery; Ethos reputation context; X identity and sharing; Hyperliquid market and account reads; client-signed API-wallet execution relay with mock receipts labelled SIMULATED; execution tracking; Pass lifecycle; PASS performance analytics; Chrome MV3 extension for X context and discovery; deployed web (Vercel), API and database (Railway Postgres).

Binding constraints (must preserve):

- No session without identity; no wallet state on identity surfaces.
- Server holds no Hyperliquid signing secrets; never receive a master private key or seed phrase; do not persist client agent private keys.
- No automated copy trading, no AI trade generation, no custodial funds, no token or DAO mechanics, Hyperliquid-only and single-chain in MVP, no social chat or groups in MVP.
- No synthetic trust score; no merging of PASS performance with Hyperliquid account performance; no risk or safety rating synthesized by PASS.
- Pass history is append-only; never silently rewrite historical versions.
- Do not execute a stale Pass without a fresh review.
- Extension never holds trading keys; Manifest V3 with narrowest permissions; no remote executable code.
- Never log private keys, seed phrases, wallet secrets, OAuth client secrets, or plaintext refresh tokens. Never store wallet secrets in localStorage.
- Every `SIMULATED` label on mock execution stays until a funded live fill lands.

Explicitly undecided or deferred: funding a live Hyperliquid test account (blocks the live execution flip); reconnecting an X account bound to a different PASS user (throws loudly by design); expired X tokens read as disconnected (no silent refresh).

## Brand Commitments

Name: PASS. Core object: Pass (verb set: create a Pass, share a Pass, take a Pass).

Voice: industrial-editorial. Precise, calm, slightly severe. Declarative and short. Data is stated, not celebrated. Calm under failure (state what happened and what to do next; no exclamation marks, no apology, no "oops"). No urgency theatre, no celebration of profit, no casino or hype language, no guarantees, no calling a Pass a "signal" in primary UI. Buttons name the action (`Take Pass`, `Publish`, `Authorize`).

References in `design/references/` are direction only, never specification. `design/DESIGN.md` is the visual blueprint and wins on every visual conflict.

## Evidence on Hand

- Live web: https://pass-web-dun.vercel.app ; live API: https://pass-api-production.up.railway.app ; Railway Postgres; Chrome MV3 artifact built.
- Source of truth: `README.md` authority order; `docs/DECISIONS.md`, `docs/PRODUCT_PRD.md`, `docs/TECHNICAL_SPEC.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/UX_SPEC.md`, `docs/SECURITY_SPEC.md`, `docs/EXTENSION_SPEC.md`.
- Visual blueprint: `design/DESIGN.md`; build plan: `design/FRONTEND_IMPLEMENTATION_PLAN.md`; references: `design/references/` with `SOURCES.md` and operator images; verify outputs: `design/verify/latest-mobile.txt`, `design/verify/latest-desktop.txt`.
- Verification: `docs/verification/hl-signature-2026-10-11.txt` (L1 order signing proven to account lookup on HL mainnet); Stage B and C 10-step operator browser runs passed.
- No fabricated testimonials, customers, benchmarks, pricing, or deployment claims. Stage G metrics are computed from simulated executions and every contributing row carries `simulated: true` with UI labelling.

## Product Principles

1. Proof over promise. Every number shown must be traceable to something PASS or a named provider actually knows.
2. One object per screen. A Pass is a single deliberate object of consequence, not a row in a feed.
3. Risk is always visible. Entry, TP, SL, leverage, expiry, and current market price are never behind a disclosure, hover, or tab.
4. Separation stays visible. PASS performance, Hyperliquid account performance, and Ethos reputation are never merged.
5. The Taker is the author of their own execution.

## Accessibility & Inclusion

MVP is English with UTC timestamps (absolute mono UTC plus relative hint). Every status, direction, and state carries a non-colour second signal (uppercase text label, sign glyph, text message). Icon-only controls have accessible names. Motion honors `prefers-reduced-motion` (transforms removed, opacity cross-fades capped at 120ms). Contrast minimums: body and data 4.5:1, large text 3:1, UI boundaries and focus indicators 3:1. No horizontal overflow at 375px; wide tables become stacked cards below tablet.
