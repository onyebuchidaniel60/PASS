# Execution readiness

**Status: NOT READY. Do not set `HYPERLIQUID_MODE=live` yet.**

Execution is deliberately still gated off in the deployed environment. This
document records what the approveAgent and order-relay flows actually do today,
what is missing for one real Take to succeed, how to test it on a small size,
what can go wrong, and how to roll back.

Prepared 2026-10-07. Deployed state at time of writing:

```
hyperliquidReads     = live     (Info API: mids, books, account state, fills)
hyperliquidExecution = mock     (Exchange API: order relay, agent approval)
ethos                = live
x                   = mock
```

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
   `POST /api/v1/me/trading-accounts/:id/approve-agent`. No private key, no seed
   phrase, and no key material of any kind crosses the wire — the body schema is
   `z.object({...}).strict()`, so an unexpected field is refused rather than
   ignored.
3. **Server.** `apps/api/src/routes/integrations.ts` resolves ownership from the
   session, never from the client (`FORBIDDEN` if the account is not the
   caller's), lowercases the agent address, and calls
   `ctx.adapters.hyperliquid.relayApproveAgent(...)`.
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
   `hyperliquidExecution: "mock"` and `hyperliquidReads: "live"`.
2. **Fund.** Deposit a small amount of USDC on Hyperliquid mainnet into the
   master wallet. Keep it small; this is a plumbing test.
3. **Flip writes.**
   `railway variables set --service pass-api HYPERLIQUID_MODE=live`
   then `railway up --service pass-api`.
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
| **Agent not approved** | Hyperliquid rejects the order | Same path: throw → `ORDER_REJECTED`. The user-facing text does **not** currently distinguish "agent not approved" from "order rejected" — see §6. |
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

```bash
railway variables set --service pass-api HYPERLIQUID_MODE=mock
railway up --service pass-api
curl https://pass-api-production.up.railway.app/health
```

`HYPERLIQUID_READS_MODE` stays `live`, so market data remains real; only writes
are disabled. Confirm `hyperliquidExecution: "mock"` in the response before
assuming the rollback took.

To roll back reads as well: `railway variables set --service pass-api
HYPERLIQUID_READS_MODE=mock`. Note that writes require reads, so this also
disables writes.

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
4. **CONFIRMED, and the most serious gap here: a Take is a NAKED entry.** The
   signed action is built by `buildExchangeRequest` in
   `apps/web/src/lib/signer.ts`, which calls `buildOrderAction({ assetIndex,
   isBuy, price, size, reduceOnly, tif })` — a **single** order. There is no
   take-profit or stop-loss order in the payload, and nothing in
   `execution-service.ts` places one after the fill.

   The Pass a Taker is reading advertises `takeProfit` and `stopLoss`, and the
   execution row stores them (`snapshot.takeProfit`, `snapshot.stopLoss`) — so
   the plan on screen looks bracketed while only the entry is actually sent.
   **A Taker who takes a Pass today gets an unprotected position with no exit.**

   This must be resolved before anyone but the operator places a real order. It
   is not a display problem and not a copy problem: either the venue must
   receive both legs, or the UI must stop implying that the exit is in place.
5. **Nonce is `Date.now()`.** `buildExchangeRequest` sets
   `nonce = Date.now()`, a millisecond timestamp. On Hyperliquid a nonce is
   "valid after this time", so this is a clock-dependency rather than replay
   protection. Two clients signing in the same millisecond get the same value,
   and a skewed client clock produces a stale or prematurely-valid action.
6. **`reduceOnly` and `tif` are caller-supplied.** Verify what the Take flow
   actually passes for both before testing; an unintended `reduceOnly` would
   open a position backwards.
7. **Live X identity is still mock.** `x = mock`, so identity and profile
   linking have not been exercised against the real provider.
8. **No end-to-end test against mainnet.** Every test either mocks `fetch` or runs
   against mock adapters. Nothing asserts that a real relay succeeds.