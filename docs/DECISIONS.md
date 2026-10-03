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
