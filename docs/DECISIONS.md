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

## D-018 — Implementation clarifications (pre-build)

These clarifications resolve ambiguities detected during the pre-build
source-of-truth audit. Where a clarification conflicts with a lower-authority
doc, this decision wins. The named lower doc must be edited to conform.

### D-018.1 — `.clinerules` is non-authoritative

`AGENTS.md` is the only coding-agent rule file OpenCode must obey.
`.clinerules` exists for compatibility with an earlier tool and must be ignored
by OpenCode. If `AGENTS.md` and `.clinerules` disagree, `AGENTS.md` wins.
`.clinerules` must not be edited, deleted, or referenced by OpenCode.

### D-018.2 — Hackathon time box

`docs/HACKATHON_SUBMISSION.md` records the Colosseum Crypto World's Fair
submission deadline as 2026-10-12. This is an active constraint on the first
build. Prefer a working, deployed, end-to-end product over polish. Visual
design is executed in a separate track per D-017 and is not a gate on the
one-shot build.

### D-018.3 — Signed execution transport

The Taker's client signs the Hyperliquid action and submits the signed payload
to `POST /passes/{id}/executions`. The PASS API:

1. authenticates the Taker;
2. verifies the Pass exists and is active;
3. verifies the Pass version in the request matches the current published
   version (or an explicitly allowed prior version);
4. verifies the referenced trading account belongs to the Taker;
5. verifies the `clientRequestId` has not been seen before;
6. relays the signed payload to the Hyperliquid Exchange API;
7. records the `provider_order_id` and the execution row;
8. reconciles status via the Hyperliquid Info API.

The PASS backend never receives a private key or seed phrase and never
persists the agent private key. It receives a signed payload, which is not
secret material and is protected from replay by Hyperliquid's nonce mechanism
and by PASS's `clientRequestId` idempotency key.

The "or directly to Hyperliquid" alternative in `docs/TECHNICAL_SPEC.md` §7
step 6 is removed for the MVP. Server-relay is the only supported path.

### D-018.4 — Pass identifier rules

- Public reads (`GET /passes/{publicId}`, share URLs) use `passes.public_id`.
- Authenticated mutations (`PATCH`, `publish`, `cancel`, execution preview,
  execution record) use the internal `passes.id` UUID.
- `/p/{publicId}` is the immutable authoritative URL.
- `/@{traderSlug}/{asset}-{direction}` is a human-readable convenience URL.
- `passes.slug` is unique per `(trader_id, slug)`.

### D-018.5 — Pass versioning source of truth

- The `passes` row holds the current working/published state.
- `pass_versions` holds immutable snapshots of every execution-relevant
  version.
- Every execution references `(pass_id, pass_version)`. That pair must always
  resolve in `pass_versions`, regardless of later Pass edits.
- Editing an execution-relevant field on a live Pass MUST create a new
  `pass_versions` row and a `pass_events` row before the change is visible on
  the public page.

### D-018.6 — Role of `identities`, `x_connections`, `ethos_profiles`

- `identities` — public identity binding (one row per provider per user).
  Holds the provider subject id, username, display name, avatar.
- `x_connections` — X OAuth token material. Encrypted at rest. Never exposed
  publicly, never returned by any public endpoint.
- `ethos_profiles` — cached Ethos reputation snapshot, refreshed periodically.
  Read-only from the public API.

A user may have an `identities` row for X without an `x_connections` row (for
example, display-only identity linking without OAuth tokens).

### D-018.7 — Ethos refresh scope

`POST /integrations/ethos/refresh` operates only on the authenticated user's
own linked identity. Public Ethos context is read-only via
`GET /profiles/{slug}/reputation`, backed by the cached `ethos_profiles`
snapshot. "Permitted public identity lookup" is not a valid scope; remove the
phrase from `docs/API_CONTRACTS.md` §6.

### D-018.8 — Error code authority

`docs/API_CONTRACTS.md` §14 is the authoritative error-code list.
`docs/TECHNICAL_SPEC.md` §17 is illustrative only. Where they differ,
API_CONTRACTS wins. Do not add new error codes outside §14 without adding them
to §14 first.

### D-018.9 — Server holds no Hyperliquid signing secrets

No `HYPERLIQUID_API_KEY`, agent private key, seed phrase, or master key may
appear in backend environment variables. The `HYPERLIQUID_*` env vars listed
in `docs/DEPLOYMENT_OPERATIONS.md` §5 are read-only URLs only. This is a
security invariant, not a preference.

## D-019 — Wallet connector and profile URL convention

### D-019.1 — Wallet connector

**Decision:** The PASS web client uses **wagmi + viem + ConnectKit** for
master wallet connection and EIP-712 signing.

**Rationale:** Hyperliquid L1 actions (including `approveAgent` and order
actions) are EIP-712 typed data; viem's signing primitives map directly. No
embedded wallet means no additional custody surface, which keeps
`docs/SECURITY_SPEC.md` §3 intact. ConnectKit supplies a mature connector UI
without committing PASS to a proprietary key-management vendor. If
email/phone onboarding is added later, an embedded-wallet provider may be
layered alongside wagmi without replacing it.

**Constraints:**
- The master wallet signs only the `approveAgent` action. It never signs
  order actions.
- The agent/API wallet key is generated client-side using viem
  `generatePrivateKey`.
- The agent key is used only to sign L1 action typed data.
- Never send the agent key to the server (D-018.3, D-018.9).
- Never store the agent key in `localStorage` (`docs/SECURITY_SPEC.md` §4).

### D-019.2 — Agent key client-side storage

**Decision:** The agent private key is stored client-side using an
encrypted IndexedDB record whose encryption key is derived from a
deterministic master-wallet signature. On session start, the user
re-authorizes by re-signing the derivation message; the key is decrypted
in memory only for the duration of the session.

**Rationale:** Avoids `localStorage`, avoids server-side key custody, keeps
the key recoverable across page reloads without asking the user to
re-approve the agent on every visit.

**Fallback:** If derivation is unavailable (wallet cannot sign typed data),
PASS falls back to in-memory-only agent storage for the session and warns
the user that they must re-authorize next visit.

### D-019.3 — Profile URL convention

**Decision:** Public Trader profile URLs use `/u/{slug}`.

**Rationale:** Next.js App Router reserves top-level `@` for parallel
routes. `/@slug` cannot be served without routing workarounds that are not
worth their maintenance cost. The immutable Pass URL `/p/{publicId}` is
unaffected and remains the canonical share URL. The pretty URL was a
convenience; `/u/{slug}` is acceptable.

`docs/PRODUCT_PRD.md` §16 and any other doc that references `/@{slug}` must
be updated to `/u/{slug}`.

## D-020 — Worker runs in-process on the API (MVP only)

**Decision:** For the MVP deployment, the worker's scheduled jobs run inside
the API process via an in-process scheduler. A separate worker service is not
deployed.

**Context:** Railway's free tier does not permit provisioning the additional
worker service alongside the API and Postgres without consuming the
workspace's remaining allowance, which is held by an unrelated project that
must remain running. Upgrading is out of scope for the hackathon window.

**Rationale:** The worker's jobs (Pass expiry reconciliation, order/execution
reconciliation, performance aggregation, Ethos profile refresh, stale-data
cleanup) are lightweight and already documented as safe to retry and
idempotent per `docs/DEPLOYMENT_OPERATIONS.md` §11. Running them in-process
is acceptable for MVP load.

**Constraints:**
- `apps/worker/` remains a package exporting job definitions. The API imports
  and runs them. Do not delete the package — the future split must be a
  deployment change, not a code rewrite.
- Jobs are gated behind `ENABLE_JOBS=true`. Tests and local development
  default to `false` unless explicitly enabled.
- Jobs must remain idempotent and safe to retry.
- Jobs must not block the API event loop. Anything CPU-bound must yield; do
  not run synchronous long loops.

**Overrides:** `docs/DEPLOYMENT_OPERATIONS.md` §4 currently lists a separate
"worker/job runner" as a required production component. D-020 overrides this
for the MVP. The doc must be updated to state the override and the future
requirement to split the worker out before real load or production SLA.

**Expiry:** D-020 is MVP-only. It must be revisited before any real traffic,
any paying user, or any production SLA.

## D-021 - Hyperliquid reads and execution are gated by separate flags

**Date:** 2026-10-07
**Status:** Accepted. In force.

### Context

`HYPERLIQUID_MODE` controlled one `LiveHyperliquid` object that implemented the
whole `HyperliquidPort`: Info API reads (`allMids`, `l2Book`, `clearinghouseState`,
`userFills`) *and* Exchange API writes (`relaySignedAction`,
`relayApproveAgent`). `relaySignedAction` submits a real signed order to
Hyperliquid mainnet.

That made "give me live market data" and "allow real orders" the same switch.
The operator asked for live reads with execution explicitly withheld, and there
was no way to express that state: setting the flag for the first thing armed the
second. The configuration in which PASS can accidentally trade real money was one
environment variable away.

### Decision

Split the gate.

- `HYPERLIQUID_READS_MODE` - Info API reads. Needs `HYPERLIQUID_INFO_URL` only,
  which is public and credential-free (D-018.9).
- `HYPERLIQUID_MODE` - Exchange API writes. Retained as the single switch for a
  fully live venue. Still requires **both** flags, so the read-only flag cannot
  arm an order by itself.
- `SplitHyperliquid` implements both halves independently and rejects, at
  construction, the one combination that must never run: **live writes with mock
  reads**. Real orders against simulated prices is the single state capable of
  convincing a Taker to trade on a number that is not the market's.
- With writes gated off, `relaySignedAction` and `relayApproveAgent` return an
  explicit rejection and make **no network call**.
- `getOrderStatus` follows the reads flag, because it is an Info API call.
- `/health` and the UI report `hyperliquidReads` and `hyperliquidExecution`
  separately. The combined `hyperliquid` mode is `live` only when both halves
  are, so any consumer not yet updated still gets the conservative answer.
- The demo banner names only the surfaces that are simulated, and states
  explicitly that orders cannot be placed while execution is mock.

### Consequences

- "Live reads, no execution" is representable, and the deployed state is
  exactly that: `hyperliquidReads: live`, `hyperliquidExecution: mock`.
- A Taker can see real prices on a deployment that cannot trade. That is honest
  and it is the point; the banner has to say so in words, which it does.
- Two flags instead of one is one more thing to set. Accepted: the cost of
  misconfiguring this particular pair is an unfunded trader's real order.
- `execution-service.ts` now treats a **returned** rejection as a rejection. It
  previously only handled a thrown one, so a rejected relay would have been
  recorded as a real execution with an empty `provider_order_id`.

### Related

`docs/EXECUTION_READINESS.md` records the current execution posture. It is not
ready: a Take today sends a single entry order with no take-profit or stop-loss
leg. That is unrelated to this decision and must be fixed before anyone but the
operator places a real order.

## D-022 — First-time user tour

**Date:** 2026-10-09
**Status:** Accepted. In force.

### Decision

PASS ships a dismissable, one-time tour for users who complete onboarding.
The tour is a short sequence of overlay cards introducing the four primary
surfaces (Discover, My Passes, Executions, Profile) and the Take flow.

### Scope

Text and a Next/Back/Skip control. No video, no animation beyond the
existing motion helpers (`design/DESIGN.md` §14), no per-screen hotspots in
this version. Five steps: Discover, Take flow, My Passes, Executions,
Profile. Each step is one heading, one short paragraph, one CTA.

### Shown once

Completion is stored on the profile as `profiles.tour_completed_at`
(`timestamptz`, null means never completed), set via the existing
`PATCH /api/v1/profiles/me`. Reload does not re-show. A returning user can
re-open it from Profile settings, which resets the column to null. Onboarding
completion itself needs no new column: the profile row is the record.

### Storage note

The column is added by migration `0002_profile_tour_completed_at.sql`. A new
table was rejected: tour state is a single nullable scalar per user with no
relations of its own.

### Not a Stage B gate

Stage B closes on the onboarding flow; the tour ships alongside.

## D-023 — X is the identity; wallet is execution-only

**Date:** 2026-10-09
**Status:** Accepted. In force.

**Decision:** PASS identity is X-only. The X identity determines the
display name, handle, avatar, profile slug, Ethos resolution, and pass
authorship. The Hyperliquid wallet is not part of identity.

**Wallet connection happens lazily, at the moment a signature is
required** — first Take, first approveAgent. It is not connected during
onboarding, not shown in the topbar, not shown on Profile, not shown in
the profile settings, not returned by /me as an identity.

**Why:** wallet connection is a signing concern, not an identity
concern. Coupling them confused the identity model, produced stale
"connected" states, and made disconnects ambiguous. Decoupling matches
Hyperliquid's model (account address vs signer) and D-015 (Taker
authorizes their own execution).

**Consequences:**
- Onboarding is X + profile + Ethos. No wallet step.
- /me connections[] no longer carries a hyperliquid identity entry.
- trading_accounts rows are internal — never rendered as a
  connection state.
- Take flow owns wallet connect, address read, agent approval.
- D-019.1 is unchanged (wagmi + viem + ConnectKit remain the stack);
  D-023 governs when the wallet is connected, not how.

## D-024 — Sign-out is sign-out

**Date:** 2026-10-09
**Status:** Accepted. In force. Overrides the "soft disconnect keeps the
session" behavior: there is no session-without-identity state anymore.

**Decision:** The X connection and the PASS session are the same thing.
Disconnecting X on PASS terminates the PASS session. The user is signed
out. While signed out, no user-attributed data renders on any surface —
not Profile, not Settings, not My Passes, not Executions. Those routes
show a connect CTA or redirect to landing.

**Rationale:** PASS identity is X-only (D-023). There is no separate PASS
account that exists independently of an X connection in the user's mental
model. A "signed-out topbar with signed-in profile" state is a bug, not
a feature.

**Consequences:**
- POST /auth/x/disconnect clears the session cookie in addition to its
  current work (and destroys the server session row).
- /me returns 401 for a signed-out caller. It does not return a userId
  for a disconnected user.
- Any client route that renders user data gates on session presence,
  not on "profile row exists".
- Reconnecting X signs the user back into the same user_id and profile.
  Their history is intact because rows were never deleted.
- Public pass URLs (/p/{id}) and public trader profiles (/u/{slug})
  still render — those are published artifacts, not viewer-bound data.
- Historical pass attribution: a Pass authored by this user renders the
  author's display name to the world. The author, when signed out, does
  not see their own pass list.

## D-025 — Take execution semantics

**Date:** 2026-10-10
**Status:** Accepted. In force. (D-025.4 provisional — operator to ratify.)

**Context:** Stage F wires the client's Take into a real signed
Hyperliquid order. Three semantics were previously undefined.

### D-025.1 — Entry limit price
- A **limit Pass** uses the Pass's authored `entry_price`.
- A **market Pass** uses the current mid from the Info API at
  preview time.
The chosen price is shown in the execution preview and signed into
the order. Do not silently substitute.

### D-025.2 — sizeUsd → base size
`baseSize = sizeUsd / entryPrice`, then rounded **down** to the
asset's `szDecimals` from the Info API universe. Never round up.
Rounding down keeps the notional at or below the Taker's chosen
size; rounding up would overshoot their intent.

### D-025.3 — Server/client reconciliation
The client sends the signed Hyperliquid action inside
`signedPayload.exchangeRequest`. The server relays it unchanged
(D-018.3). The client stops posting `signedAction: "demo"`. The
server's `execution-service.ts` already reads
`input.signedPayload.exchangeRequest`; the client must match that
shape exactly.

**Consequences:**
- `buildOrderAction` (already built, 16 tests) has a caller:
  `TakeFlowClient.authorize()`.
- Preview and submit use the same numbers.
- `hyperliquidExecution: mock` remains the deployed default. Wiring
  this code path does not arm it.

### D-025.4 — Pass-id resolution on the execution routes (provisional)
The Take screen only ever holds the public `public_id` (D-018.4 share
URLs), while the execution routes resolve the internal UUID. No
owner-only listing can bridge that for a Taker taking someone else's
Pass, so `POST /passes/:id/execution-preview` and
`POST /passes/:id/executions` resolve `:id` as the internal UUID
first and fall back to `public_id`. The canonical share URL is
unchanged, ownership and idempotency checks are unchanged, and the
public DTO still carries no internal id. Operator to ratify or replace
with a dedicated resolution endpoint.