# Execution readiness

**Status: LIVE ON HYPERLIQUID TESTNET (2026-10-15, merge `3d257cc`).
`HYPERLIQUID_MODE=live` with `HYPERLIQUID_READS_MODE=live` on the testnet
venue. Do not point this at mainnet without a fresh review.**

This document records what the approveAgent and order-relay flows actually
do today, the venue rules every Take obeys, how to test on a small size,
what can go wrong, and how to roll back.

Deployed state at time of writing (see also `docs/AI_HANDOFF.md` §5):

```
hyperliquidReads     = live     (Info API: mids, books, account state, fills)
hyperliquidExecution = live     (Exchange API: order relay, agent approval)
hyperliquidVenue     = testnet
ethos                = live
x                    = live
database             = live
```

Venue rules enforced on every Take:

- **$10 minimum order value.** The preview refuses smaller sizes with
  `BELOW_MIN_ORDER_VALUE` before the user signs; a venue rejection that
  arrives at relay time surfaces verbatim as `ORDER_REJECTED`.
- **10x leverage ceiling** (`MAX_LEVERAGE`), enforced in the form, the API
  schemas, and server validation.
- **Market vs limit.** A limit Pass signs Gtc at the authored entry price
  (resting is expected). A market Pass signs tif=Ioc at the marketable
  price (mid ± 50 bps slippage tolerance, shown in the preview), so it
  fills instead of resting. Exits are Take Profit Market / Stop Market.
- **One unnamed agent per master.** The Hyperliquid UI's "Enable Trading"
  deregisters PASS's agent. The approval skip is venue-checked against the
  Info API `extraAgents` list (`docs/DECISIONS.md` D-029); the DB row is a
  cache, never the source of truth.

Read the `modes` block of `GET /health` before trusting any of this.

---

## 1. What the flow does today, end to end

### 1.1 Approving an agent wallet

Hyperliquid lets a separate key (the "agent" or "API" wallet) place orders for
an account, once the account's master key has approved that agent address.

1. **Client.** `apps/web/src/components/ApproveAgentControl.tsx` builds an
   EIP-712 payload with `buildApproveAgentAction({ agentAddress, nonce })` and
   signs it with the **master** wallet via ConnectKit.
2. **Wire.** The client posts **only** `{ agentAddress, nonce, signature }` to
   `POST /api/v1/trading-accounts/{address}/approve-agent` (D-027:
   address-keyed, no session, no ownership check). No private key, no seed
   phrase, and no key material of any kind crosses the wire — the body schema is
   `z.object({...}).strict()`, so an unexpected field is refused rather than
   ignored.
3. **Server.** The route resolves the trading account by wallet address
   (never reassigned), lowercases the agent address, and calls
   `ctx.adapters.hyperliquid.relayApproveAgent(...)`. Before skipping an
   approval the client confirms the agent on the venue's `extraAgents`
   list (D-029) — the DB row is a cache, not proof.
4. **Adapter.** The relay goes through the provider adapter precisely so mock
   mode cannot contact the live venue. With `HYPERLIQUID_MODE=mock`,
   `SplitHyperliquid.relayApproveAgent` returns `{ ok: false, raw: { reason:
   "HYPERLIQUID_MODE=mock — agent approval is disabled in this deployment." } }`
   and **makes no network call at all**.
5. **Persistence.** `recordAgentApproval(...)` runs **only after** the provider
   accepted, so a rejected approval never leaves a stored agent association
   behind.

### 1.2 Placing an order (a Take)

1. **Step 1 — size.** The Taker types their own size. The field is empty by
   default and is never seeded from the Trader's size (D-015).
2. **Step 2 — preview.** `POST /api/v1/passes/{id}/execution-preview` returns the
   order summary, estimated margin, slippage tolerance and the Pass version.
   Warnings render as plain sentences, never as red borders (§10.6).
3. **Step 3 — authorization.** A plain-language statement of what will happen
   sits **above** any control, naming wallet, market, size and leverage, and
   stating that the wallet signs and PASS relays. Consent is **never pre-ticked**
   and Authorize stays disabled until it is given.
4. **Relay.** `apps/api/src/services/execution-service.ts` forwards the client's
   signed payload **unmodified** to
   `ctx.adapters.hyperliquid.relaySignedAction(...)`. PASS holds no signing key
   (D-018.3, D-018.9).
5. **Result.** A rejection — thrown, or returned with a rejected status — becomes
   `ORDER_REJECTED`. The execution row is written **only after** a relay that
   actually produced a provider order id.

### 1.3 The trust model, stated plainly

- The master private key never leaves the browser. The agent private key is
  client-held; the server neither receives nor persists it.
- PASS is a relay. It cannot move a position, cannot hold funds, and cannot sign
  for anyone.
- Every execution is explicitly confirmed by the Taker.

---

## 2. What must exist for a real Take to succeed

| # | Requirement | Present? |
|---|---|---|
| 1 | A funded Hyperliquid **master wallet** | **No** — not confirmed by the operator |
| 2 | A small amount of USDC on Hyperliquid for margin | **No** — not confirmed |
| 3 | The master wallet connected via ConnectKit on the PASS site | Client-side, present |
| 4 | A Hyperliquid trading account row linked to that master address | Code present, no live data |
| 5 | `HYPERLIQUID_READS_MODE=live` | **Yes** — live now |
| 6 | `HYPERLIQUID_MODE=live` for exchange writes | **No** — deliberately mock |
| 7 | `HYPERLIQUID_EXCHANGE_URL` set | **Yes** — `https://api.hyperliquid.xyz/exchange` |
| 8 | The agent wallet approved by the master key | Requires #1 and #6 |

Requirement 6 is blocked on requirements 1 and 2. **Do not flip it before both
are true**, because flipping it with an unfunded account turns every Take into a
rejection and, more importantly, means the next funded account in the system can
place a real order immediately.

### Read §6.4 before you run any part of this

A real Take today sends **one order and no exit**. If you test this on mainnet,
be at the Hyperliquid UI with the close button ready, and size it so that being
wrong by a large move is survivable.

---

## 3. The exact steps to test one real Take

Only after requirements 1 and 2 above are confirmed.

1. **Confirm the gates.** `GET /health` must show
   `hyperliquidExecution: "live"`, `hyperliquidReads: "live"`, and
   `hyperliquidVenue: "testnet"`.
2. **Fund.** Deposit a small amount of USDC on Hyperliquid **testnet** into
   the master wallet. Keep it small; this is a plumbing test.
3. **Flip writes.** In the Render dashboard: set `HYPERLIQUID_MODE=live`
   (with `HYPERLIQUID_READS_MODE=live`) on the API service and deploy.
   (Railway is dead; all API deploys go through Render.)
4. **Verify.** `GET /health` must show `hyperliquidExecution: "live"` **and**
   `hyperliquidReads: "live"`. If reads are not live the service **refuses to
   start** by design — real orders against simulated prices is the one state
   that must never run.
5. **Connect** the master wallet in the PASS UI.
6. **Link** the Hyperliquid trading account (`POST /api/v1/me/trading-accounts`).
7. **Approve the agent.** Trigger the approveAgent control. Confirm via
   Hyperliquid's own UI that the agent address is approved for that account.
8. **Take a Pass** at the smallest size the UI allows — for example 10 USDC at
   2x. Walk all four steps, and confirm the plain-language authorization
   statement appears before the checkbox.
9. **Verify on Hyperliquid**, not only in PASS: the position should appear in
   the Hyperliquid UI, and the PASS receipt should show the real provider order
   id and status verbatim.
10. **Close the position** immediately in the Hyperliquid UI and confirm the
    close is reflected in PASS executions.

If any step fails, go to §5 first and roll back before diagnosing.

---

## 4. What can go wrong, and the path each failure takes

| Failure | How it surfaces | Current handling |
|---|---|---|
| **Nonce collision / replay** | Hyperliquid rejects with a nonce error | `relaySignedAction` throw → `ORDER_REJECTED`, logged as `hyperliquid relay failed`. **No retry is attempted**, so a duplicate order is not possible from a retry. |
| **Agent not approved** | Hyperliquid rejects the order | Same path: throw → `ORDER_REJECTED`, now carrying the venue's message verbatim. Mitigated upfront: the approval skip is venue-checked, so a deregistered agent re-approves instead of signing dead (D-029). |
| **Agent approval expiry** | Same rejection as above | Same path. Approval is re-run by the user; there is no auto-reapproval. |
| **Insufficient margin** | Hyperliquid rejects | Throw → `ORDER_REJECTED`. Note the preview's estimated margin is advisory. |
| **Slippage / price moved** | Order rejected, or filled worse than previewed | Throw → `ORDER_REJECTED`. The preview shows a `slippageTolerance`; confirm it is set before the test. |
| **Rate limited (HTTP 429)** | `ProviderError` marked retryable | Thrown as `ORDER_REJECTED` to the user. The retryable flag exists but **nothing retries on it** — see §6. |
| **Exchange unreachable** | `ProviderUnavailableError` | Throw → `ORDER_REJECTED`. Distinguishable in logs, **not** in the user-facing text. |
| **Writes still gated** | `SplitHyperliquid` returns `status: "rejected"`, empty order id | Thrown as `ORDER_REJECTED` with "Order relay is disabled in this deployment." Nothing is recorded. |
| **Rejected status returned, not thrown** | Hyperliquid sometimes answers 200 with a rejected status | Checked explicitly in `execution-service.ts`; a returned rejection is treated as a rejection and **no execution row is written**. |
| **Position left open** | No error at all — the order simply succeeds | **Nothing catches this.** The entry fills and there is no exit order, so the position stays open until the Taker closes it manually. See §6.4. |

---

## 5. Rollback

If the live test fails, put execution back to mock. It takes effect on the next
deploy and requires no code change:

In the Render dashboard: set `HYPERLIQUID_MODE=mock` on the API service
and deploy (takes effect on deploy, no code change). Then:

```bash
curl <render-api-url>/health
```

`HYPERLIQUID_READS_MODE` stays `live`, so market data remains real; only writes
are disabled. Confirm `hyperliquidExecution: "mock"` in the response before
assuming the rollback took.

To roll back reads as well, set `HYPERLIQUID_READS_MODE=mock` in the same
dashboard. Note that writes require reads, so this also disables writes.

---

## 6. Known gaps to close before mainnet

These are honest gaps, not hypotheticals. None is a blocker for a small
mainnet test; all of them are blockers for real users at real size.

1. **Rejections are not classified.** `ORDER_REJECTED` collapses "agent not
   approved", "insufficient margin", "price moved" and "exchange down" into one
   message. A Taker cannot tell what to fix. The provider's reason is available
   in the relay result and should be surfaced.
2. **No retry on retryable provider errors.** `ProviderError` carries
   `retryable: true` for 429 and 5xx, and nothing consumes it. Re-adding a retry
   needs care: a retried order after an ambiguous timeout can double-execute
   unless the client request id is used for idempotency.
3. **No idempotency enforcement on relay.** `clientRequestId` exists on the
   execution row, but it is not checked before relaying.
4. **CLOSED 2026-10-10 by wiring (D-025): the builder has a caller.**
    `TakeFlowClient.authorize()` builds entry + reduce-only TP/SL in one
    `grouping: "normalTpsl"` action, signs with the client-held agent key,
    and posts the real `signedPayload` — `signedAction: "demo"` is gone.
    Entry/limit-vs-mid, sizeUsd→baseSize floor, and reconciliation are
    decided in D-025.1–D-025.3; pass-id resolution in D-025.4
    (provisional). The remaining cautions stand: no live mainnet
    submission has happened, leverage is not set as a separate action
    (orders execute at the account's current leverage — residual), and
    the funded live test below still requires operator funding plus
    legs visible on Hyperliquid's own UI.

    The original gap text is kept for history: the builder emitted the
    correct bracket and was covered by 16 tests but had no callers while
    `authorize()` posted the literal string
    `{ sizeUsd, leverage, signedAction: "demo" }`. The three open product
    questions it listed (entry limit price, sizeUsd→base conversion,
    server/client shape reconciliation) are now decided in D-025.1–D-025.3.
    Gap 6 below is likewise answered for the Take path: entry
    `reduceOnly: false`, exits `reduceOnly: true`, `tif: "Gtc"`,
    asserted in `takeFlow.test.tsx`.
5. **Nonce is `Date.now()`.** `buildExchangeRequest` sets
   `nonce = Date.now()`, a millisecond timestamp. On Hyperliquid a nonce is
   "valid after this time", so this is a clock-dependency rather than replay
   protection. Two clients signing in the same millisecond get the same value,
   and a skewed client clock produces a stale or prematurely-valid action.
6. **CLOSED 2026-10-15: `tif` is decided by order type.** Market entries
   sign `tif: "Ioc"` at the marketable price (mid ± 50 bps); limit entries
   sign `Gtc` at the authored price; exits are reduce-only trigger-market.
   Asserted in `takeFlow.test.tsx`. `reduceOnly` remains caller-supplied —
   verify it before testing; an unintended `reduceOnly` would open a
   position backwards.
7. **Live X identity is still mock.** `x = mock`, so identity and profile
   linking have not been exercised against the real provider.
8. **No end-to-end test against mainnet.** Every test either mocks `fetch` or runs
   against mock adapters. Nothing asserts that a real relay succeeds.

---

## 7. Live-signature verification without funds (Stage F closure)

`scripts/verify-live-signature.mjs` proves the client's order shape and L1
signing are accepted by Hyperliquid directly, without touching the PASS
server and without funds.

Invocation (keys are operator-supplied per run, throwaway, never committed):

```bash
VERIFY_AGENT_KEY=0x... VERIFY_ACCOUNT_ADDRESS=0x... node scripts/verify-live-signature.mjs
```

What it does:

1. Reads `VERIFY_AGENT_KEY` (agent private key) and `VERIFY_ACCOUNT_ADDRESS`
   (master address, logging only) from env.
2. Fetches the live BTC mid from the Info API (read-only).
3. Builds a minimal $10 BTC long via the same `buildOrderAction` the Take
   flow signs (imported from `apps/web/src/lib/hyperliquid.ts`, not
   duplicated).
4. Signs it via the same L1 flow `signExchangeRequest("live", …)` uses
   (`privateKeyToAccount` + `signL1Action` — Exchange domain, phantom
   agent, never user-signed typed data).
5. POSTs `{ action, nonce, signature }` directly to
   `https://api.hyperliquid.xyz/exchange`.
6. Prints the full response body verbatim.

Interpretation:

- Exit `0` with a balance-related rejection (`insufficient margin`,
  `not enough balance`, or HL's actual unfunded-account wording) means
  **pass**: HL validated the signature and order schema before checking
  balance, so the code is complete and only money is missing.
- Exit `1` with `User or API Wallet … does not exist` means the agent was
  never approved and/or the account never touched HL. Approve the agent
  from the master account first, then re-run. This is an authorization
  rejection, not the balance proof.
- Exit `1` with a signature/schema/viem primary-type error means the
  signing path or order shape is wrong. Do not attempt the server relay
  until this is fixed.
- Exit `2` means the network call to HL failed.

Orders are L1 actions (`signL1Action`, Exchange domain, chain 1337).
`approveAgent` is a user-signed action (`HyperliquidSignTransaction`).
The two flows must not be confused: signing an order as user-signed typed
data will be rejected by HL before any balance check.