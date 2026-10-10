# PASS — AI Implementation Handoff

**Last updated:** 2026-10-10
**Status:** Active build. Stages A–B closed, C in progress, F is the
remaining critical-path gate.

This file is the single source of truth for **current state**. Where it
disagrees with any other doc about what is done or what is next, this
file wins. Where it disagrees about product behavior or architecture,
the source-of-truth order in README.md wins.

---

## 1. Mission

Build PASS exactly as defined by the source-of-truth documents and get a
complete, deployed first version usable end-to-end.

Treat the coding agent as an implementation engine, not a product
strategist.

## 2. Product in one paragraph

PASS lets a Trader turn a Hyperliquid trade plan into a shareable Pass.
The Pass is distributed through X, enriched with the Trader's X identity
and Ethos reputation context, and can be independently taken by another
Trader who selects their own position size and authorizes execution on
Hyperliquid. PASS is non-custodial.

## 3. Mandatory first-build surfaces

All of these must exist in the first complete build:

- responsive web application
- authenticated onboarding/profile
- Pass creation/edit/publish/cancel
- public Pass page
- Trader profile
- discovery
- Ethos reputation context
- X identity/sharing
- Hyperliquid market/account data
- Hyperliquid API-wallet/agent execution
- execution tracking
- Pass lifecycle
- PASS performance analytics
- Chrome MV3 extension for X context/discovery
- deployed web/API/database

## 4. Hard constraints (unchanged)

1. Do not store seed phrases or master private keys.
2. Do not send client-held agent private keys to the server.
3. Do not implement automatic copy trading.
4. Do not create a synthetic trust score.
5. Do not silently rewrite historical Pass versions.
6. Do not execute a stale Pass without a fresh review.
7. Do not let the extension become a trading-key holder.
8. Do not invent unsupported provider fields.
9. Do not claim unverified metrics.
10. Do not call the project complete without a live deployment.

Additional binding constraints established during the build (see §7):

- X is the only identity. Wallet is execution-only (D-023).
- X disconnect terminates the PASS session (D-024).
- Hyperliquid reads and execution use separate flags (D-021).
- Server holds no Hyperliquid signing secrets (D-018.9).

## 5. Current state

### 5.1 Deployment

| Surface | Value |
|---|---|
| Web | https://pass-web-dun.vercel.app |
| API | https://pass-api-production.up.railway.app |
| Database | Railway Postgres |
| Extension | Chrome MV3, artifact built |
| Repo | onyebuchidaniel60/PASS, branch `main` |

Provider modes (`GET /health`):

    hyperliquidReads:     live     (Info API: mids, books, account state, fills)
    hyperliquidExecution: mock     (Exchange writes gated off)
    ethos:                live
    x:                    live
    database:             live

`hyperliquidExecution: mock` is deliberate. Do not arm it in any
session until the operator has funded a test account and Stage F wiring
is complete. See `docs/EXECUTION_READINESS.md`.

### 5.2 Stage status

| Stage | Status | Notes |
|---|---|---|
| A — Repository and foundation | Met | |
| B — Identity end-to-end | Met (2026-10-09) | 10-step operator browser run passed |
| C — Create and publish a Pass | In progress | Verification run pending |
| D — Public experience | Met | |
| E — Hyperliquid reads | Met | `hyperliquidReads: live` |
| F — Hyperliquid execution | Not met | The remaining critical-path gate |
| G — Performance and lifecycle | Blocked by F | |
| H — X distribution | Met | |
| I — Chrome extension | Met | |
| J — Deployment | Partial | Deployed, but execution leg blocked by F |
| K — Frontend design track | Visually unverified | Screens rebuilt, no agent-as-user sign-off |

**Deadline:** 2026-10-12 (Colosseum Crypto World's Fair).

### 5.3 What just closed (Stage B)

The gate was "a test user can create a complete profile without
exposing secrets." Closed by a 10-step operator browser run on
2026-10-09:

1. Sign in with X
2. Onboarding: 3 steps, no wallet step
3. Topbar: X chip only
4. Profile signed-in: name, slug, bio visible
5. Disconnect X: routed away immediately, no flash of user data
6. `/settings` signed-out: connect CTA only, no name, slug, bio, Save
7. My Passes signed-out: CTA only, no list
8. Executions signed-out: CTA only
9. `/passes/new` signed-out: blocked
10. Public pass URL renders signed-out; reconnect returns same user

Deploy SHA at closure: `b2fc322` (code) / `0baa4cc` (docs).

### 5.4 What is in progress (Stage C)

Gate: **a Trader can create and publish a Pass; a logged-out browser
can open it.**

The 10-step verification run is the current task. Steps:

1. Sign in + complete onboarding
2. Navigate to Create Pass
3. Fill form
4. Preview correct
5. Publish
6. Public URL signed-out renders
7. Author sees it in My Passes
8. Edit execution-relevant field → new pass_version, public page updated
9. Cancel → state cancelled, no new executions accepted

If steps pass: Stage C met. If a step fails: fix that step, redeploy,
re-run only that step.

### 5.5 The next critical-path gate (Stage F)

Once Stage C is met, Stage F is the only remaining blocker on the
hackathon's "usable end-to-end" definition. Stage F requires:

- Wiring `buildOrderAction` into `TakeFlowClient.authorize()`. The
  builder already emits entry + reduce-only TP + reduce-only SL in a
  single `grouping: "normalTpsl"` action and is covered by 16 tests. It
  has no callers.
- Three decisions to record before wiring:
  - Entry limit price: limit Pass uses its entry price; market Pass uses
    current mid.
  - `sizeUsd` → base size: `baseSize = sizeUsd / entryPrice`, rounded
    down to asset's `szDecimals`. Never round up.
  - Server/client reconciliation: server's
    `signedPayload.exchangeRequest` is the single source of truth.
    Client stops posting `signedAction: "demo"` and posts the real
    signed action.
- Wallet connect happens lazily at Take time (D-023), not during
  onboarding.
- `approveAgent` is a first-execution concern (D-019.1), not
  onboarding.

Stage F live test requires a funded Hyperliquid account. Operator has
not funded yet. Mock test path exists.

### 5.6 What comes after F

- **Stage G** unblocks when F completes. Performance data exists once a
  real execution lands.
- **Stage K** visual verification is a separate track (D-017). It does
  not gate the hackathon submission but the video re-record does.
- **Video re-record**: voiceover recorded. Screen clips are pre-§14 UI.
  If execution goes live before submission, update Section 5's "running
  on demo data" line.

## 6. Core decisions index

Full text in `docs/DECISIONS.md`. Summaries for orientation:

| Decision | What it settles |
|---|---|
| D-001–D-015 | Product name, core object, execution model, X/Ethos roles, scope exclusions |
| D-016 | Default branch is `main` |
| D-017 | Frontend design track begins after the one-shot build |
| D-018 | Implementation clarifications (D-018.1–D-018.9): .clinerules non-authoritative, signed transport, Pass IDs, versioning, identity/x_connections/ethos_profiles roles, Ethos refresh scope, error code authority, no HL signing secrets on server |
| D-019 | Wallet connector (wagmi + viem + ConnectKit), agent key client-side, `/u/{slug}` profile URL |
| D-020 | Worker runs in-process on the API (MVP only) |
| D-021 | Hyperliquid reads and execution gated by separate flags |
| D-022 | First-time user tour: dismissable, one-time, 5 steps |
| D-023 | **X is the identity; wallet is execution-only.** Wallet connects lazily at Take |
| D-024 | **Sign-out is sign-out.** X disconnect terminates the PASS session. No session-without-identity state exists |

## 7. Binding invariants established during the build

These are not preferences. Do not violate them to unblock a task.

1. **No session without identity.** X connection ≡ PASS session. There
   is no signed-in state without an X connection (D-024).
2. **Wallet is not identity.** Never render wallet state on any identity
   surface (topbar, Profile, Settings, onboarding). Wallet appears at
   Take time, and only at Take time (D-023).
3. **Reads and writes are separate gates.** `HYPERLIQUID_READS_MODE`
   and `HYPERLIQUID_MODE` are independent. `SplitHyperliquid` rejects
   live-writes-with-mock-reads at construction (D-021).
4. **Server holds no Hyperliquid signing secrets.** No
   `HYPERLIQUID_API_KEY`, agent private key, seed phrase, or master key
   in env vars (D-018.9).
5. **Rows survive sign-out.** Disconnect/clear session does not delete
   `users`, `profiles`, `identities`, `x_connections`, `passes`,
   `trading_accounts`.
6. **Public artifacts render regardless of viewer state.** `/p/{id}`
   and `/u/{slug}` render to signed-out viewers.
7. **Pass history is append-only.** Editing an execution-relevant field
   creates a new `pass_versions` row and a `pass_events` row before the
   change is visible (D-018.5).
8. **One `/me` shape, one reader.** All identity derivation lives in
   `apps/web/src/lib/me.ts`. No second reader.
9. **No secrets in logs, chats, or commits.** Client secret, session
   secret, cookies, tokens — redacted everywhere.

## 8. Known residuals (documented, not hidden)

These are known and accepted. They are not blockers for the hackathon.

1. **Reconnecting an X account bound to a different PASS user throws
   loudly.** No silent reassignment (D-018.6, SECURITY_SPEC §10). This
   is the correct conservative behavior for a future reclaim case.
2. **`API_CONTRACTS.md` §2 does not pin `/me` field shapes.** This is
   the root cause of two shipped crashes. Recommendation: pin it in a
   follow-up.
3. **Expired X tokens read as disconnected, no silent refresh.** User
   reconnect restores. Refresh implementation is deferred.
4. **Pre-existing duplicate user rows from the pre-proxy era remain in
   production.** Operator-managed. The callback now signs into the
   owning user, so these no longer collide.
5. **Full single-shot `pnpm test` / `pnpm run check` exceed one tool
   call on the operator's machine under load.** Phased runs substitute.
   Not a code issue.
6. **SettingsClient save/connect props partially unwired** — pre-existing
   scaffolding, deferred.

## 9. Definition of done (unchanged)

A user who finds a PASS link from X can:

    open Pass
    -> inspect Trader
    -> inspect Ethos context
    -> inspect Trade Plan
    -> choose own position size
    -> review current market/order parameters
    -> authorize
    -> execute on Hyperliquid
    -> see execution status

A Trader can:

    connect identity
    -> create Pass
    -> publish
    -> share on X
    -> monitor execution/outcome

The extension can:

    load on X
    -> recognize relevant Trader/post
    -> show PASS context
    -> open correct Pass/profile

## 10. When blocked

Do not improvise a product decision to unblock yourself. Prefer:

- current source-of-truth decision
- official provider docs
- a minimal adapter/fallback
- a documented unresolved gap

If the block is a product decision, **stop and ask the operator**. Do
not choose for them.

## 11. Working method

1. Read `README.md` and the source-of-truth order.
2. Read this file.
3. State which stage/gate the task advances. If it cannot say "this
   moves Stage X from not-met to met," it is polish and belongs in a
   separate pile.
4. Reproduce before fixing.
5. Fix the smallest correct thing.
6. Add a regression test that fails without the fix.
7. Run the full relevant test suite.
8. Redeploy.
9. **Operator browser walk.** No stage is called met from code alone.
   The gate is the flow, in the deployed UI.

## 12. Reporting expectations

Every report should state, in order:

1. Stage/gate advanced.
2. Repo state before changes.
3. Files changed.
4. Tests added and results.
5. Deploy SHA(s) and `/health` modes.
6. Operator browser run result — pass/fail each step.
7. Stage status: met / not met, with reason.
8. Named residuals.

If any step fails, stop. Do not bundle a second fix.

## 13. Never do this

- Mark a stage met from a green test suite alone.
- Mark a stage met from a "code-complete, awaiting operator" report.
- Hide a bug behind a branch that only fixes the agent's viewport.
- Silently reassign an X identity or trading account to a different
  user.
- Delete rows to work around a state-management bug.
- Touch the OAuth callback, PKCE, state, or redirect_uri without a
  decision.
- Arm `hyperliquidExecution` without operator go-ahead.
- Paste secrets into chat, code, commits, or logs.
- Edit `.clinerules`.
- Defer the extension, Hyperliquid execution, Ethos, X, or analytics to
  a later phase.

---

## Changelog

- **2026-10-03** — Initial handoff (pre-build).
- **2026-10-09** — Stage B met (10-step operator run). D-023, D-024
  recorded. Session model pinned. This file restructured into a living
  state record with a decisions index, invariants, and residuals.
- **2026-10-10** — Stage C verification run (signed-out browser +
  production API). Public pass renders signed-out; publish/edit/cancel
  have no web UI (API-only). Stage C not met, awaiting operator run.
