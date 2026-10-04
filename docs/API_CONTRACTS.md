# PASS — API Contracts

These are PASS domain contracts. Provider-specific request/response shapes remain inside integration modules.

## 1. Conventions

Base path:

```text
/api/v1
```

JSON responses unless otherwise stated.

Error format:

```json
{
  "error": {
    "code": "PASS_EXPIRED",
    "message": "This Pass is no longer active.",
    "details": {}
  },
  "requestId": "req_123"
}
```

## 2. Authentication

Web authentication should use a secure session mechanism with HttpOnly/Secure/SameSite cookies or an equivalent architecture. OAuth state and PKCE artifacts must be protected against CSRF and login injection.

## 3. Public endpoints

### GET `/passes/{publicId}`

Returns the public Pass, Trader summary, available reputation context, and a market snapshot.

### GET `/profiles/{slug}`

Returns public Trader profile and summary metrics.

### GET `/profiles/{slug}/passes`

Returns paginated public Passes. Pagination must be cursor-based where practical.

## 4. Profile endpoints

### POST `/profiles`

Create the authenticated user's PASS profile.

```json
{
  "slug": "traderx",
  "displayName": "Trader X",
  "bio": "BTC / ETH perpetual trader"
}
```

### PATCH `/profiles/me`

Update editable profile fields.

## 5. X integration

### GET `/auth/x/start`

Starts X authentication/identity connection.

### GET `/auth/x/callback`

Validates OAuth state/PKCE, exchanges authorization code, resolves X identity, and creates/updates the identity record.

### POST `/sharing/x`

Creates a share intent and, when the user has granted appropriate permissions, may create an X post.

```json
{
  "passId": "8xK29",
  "mode": "copy|post"
}
```

`copy` must remain usable even when native posting is unavailable.

## 6. Ethos endpoints

### GET `/profiles/{slug}/reputation`

Returns the latest normalized Ethos context known to PASS.

### POST `/integrations/ethos/refresh`

Refreshes the reputation information for the current user's own linked identity only. This endpoint operates exclusively on the authenticated caller; it cannot be used to refresh or enumerate any other identity. Public Ethos context is served read-only from the cached snapshot via `GET /profiles/{slug}/reputation`. Per `docs/DECISIONS.md` D-018.7, no other lookup scope is valid for this endpoint.

## 7. Pass endpoints

### POST `/passes`

Request:

```json
{
  "asset": "BTC",
  "direction": "long",
  "entryType": "limit",
  "entryPrice": "113400",
  "stopLoss": "111900",
  "takeProfit": "116000",
  "leverage": "5",
  "thesis": "BTC reclaiming resistance with increasing volume.",
  "expiresAt": "2026-10-03T18:00:00Z"
}
```

Returns the draft Pass plus its first version.

### PATCH `/passes/{id}`

Updates a mutable Pass. The endpoint must create a new version/event when an update affects execution-relevant fields.

### POST `/passes/{id}/publish`

Publishes a draft. Publishing validates the plan, resolves the public ID/URL, and creates the publication event.

### POST `/passes/{id}/cancel`

Cancels an active Pass. Cancellation is terminal for that Pass instance.

## 8. Execution endpoints

### POST `/me/trading-accounts/{id}/approve-agent`

Approves a Hyperliquid API/agent wallet on behalf of the authenticated owner (see `docs/DECISIONS.md` D-019.1).

The client generates the agent key in the browser, asks the **master wallet** to sign the `approveAgent` EIP-712 payload, and submits only the signature and the agent address. The server never receives a private key (D-018.3, D-018.9).

Request:

```json
{
  "agentAddress": "0x…",
  "nonce": 1760000000000,
  "signature": { "r": "0x…", "s": "0x…", "v": 27 }
}
```

Response:

```json
{
  "ok": true,
  "agentAddress": "0x…",
  "accountAddress": "0x…",
  "mode": "live"
}
```

Validation order:

1. authenticate the caller;
2. resolve the trading account and verify it belongs to the caller;
3. reject a malformed `agentAddress` or `nonce`;
4. relay the signed `approveAgent` action to the Hyperliquid Exchange API;
5. record `trading_accounts.agent_address` **only after** the provider accepts it.

A user-cancelled wallet signature produces no request. A provider rejection returns `SIGNATURE_REJECTED` and records nothing, so a rejected approval never leaves a stored agent association.

### POST `/passes/{id}/execution-preview`

Request:

```json
{
  "passVersion": 2,
  "accountId": "acct_123",
  "positionSize": "250",
  "leverage": "5",
  "slippageToleranceBps": 50
}
```

Response must include:

- exact Pass version being executed;
- current market snapshot;
- normalized order parameters;
- account/available-margin checks where available;
- warnings;
- whether user confirmation is required.

### POST `/passes/{id}/executions`

Request:

```json
{
  "passVersion": 2,
  "accountId": "acct_123",
  "clientRequestId": "req_abc123",
  "signedPayload": {
    "exchangeRequest": {},
    "signature": {}
  }
}
```

This is the **server-relay path** (see `docs/DECISIONS.md` D-018.3). The client signs the Hyperliquid action and submits the signed payload here; the server validates it and relays it to the Hyperliquid Exchange API. Server-relay is the only supported path in the MVP — the client must not submit directly to Hyperliquid.

`{id}` is the internal `passes.id` UUID. Authenticated mutations use the internal UUID; `passes.public_id` is for public reads only (D-018.4).

Response:

```json
{
  "executionId": "exec_123",
  "providerOrderId": "987654321",
  "status": "pending"
}
```

The server performs these steps, in this order:

1. authenticates the Taker;
2. verifies the Pass exists and is active;
3. verifies the Pass version in the request matches the current published version (or an explicitly allowed prior version);
4. verifies the referenced trading account belongs to the Taker;
5. verifies the `clientRequestId` has not been seen before;
6. relays the signed payload to the Hyperliquid Exchange API;
7. records the `provider_order_id` and the execution row;
8. reconciles status via the Hyperliquid Info API.

**Idempotency.** A duplicate `clientRequestId` must return the existing execution record — the same `executionId` and the same `providerOrderId` — or a deterministic `DUPLICATE_REQUEST` error. It must never submit a second order.

**Payload integrity.** The server must not mutate the signed payload before relaying it, except for provider-required normalization that is transparent to the user.

### GET `/executions/{id}`

Returns execution state and provider order identifiers.

### GET `/me/executions`

Returns the authenticated Taker's execution history.

## 9. Dashboard endpoints

### GET `/me/dashboard`

Returns owned Pass summary, recent executions, active Passes, and key metrics.

### GET `/me/passes`

Paginated owned Pass list.

## 10. Provider contract boundaries

Provider-specific integrations must not expose raw provider schemas through the core API unless there is a documented product reason.

Example normalized market DTO:

```ts
interface MarketSnapshot {
  provider: "hyperliquid";
  asset: string;
  markPrice: string;
  midPrice: string | null;
  observedAt: string;
}
```

For every Hyperliquid Info API read, PASS treats `trading_accounts.account_address` as the query subject, and never `trading_accounts.agent_address`. The agent address is a signer, not an account; querying it returns empty or misleading account state.

## 11. Execution idempotency

Every execution request requires a `clientRequestId`. The database must enforce uniqueness. A duplicate request must return the existing execution or a deterministic duplicate error; it must never blindly submit another order.

## 12. API validation

All request bodies must be validated. Financial values are represented as decimal strings at the API boundary to avoid floating-point ambiguity.

## 13. Rate limiting

Apply rate limits at least to:

- authentication endpoints;
- Pass creation/update;
- Ethos refresh;
- execution preview;
- execution submission;
- extension resolution endpoints.

Do not over-rate-limit public Pass reads to the point that normal social sharing becomes unusable.

## 14. Stable error codes

```text
AUTH_REQUIRED
FORBIDDEN
PROFILE_NOT_FOUND
IDENTITY_NOT_CONNECTED
PASS_NOT_FOUND
PASS_NOT_ACTIVE
PASS_EXPIRED
PASS_CANCELLED
PASS_INVALIDATED
PASS_VERSION_STALE
INVALID_ASSET
INVALID_DIRECTION
INVALID_PRICE
INVALID_POSITION_SIZE
INVALID_LEVERAGE
INSUFFICIENT_MARGIN
SLIPPAGE_EXCEEDED
SIGNATURE_REJECTED
ORDER_REJECTED
ORDER_PENDING
PROVIDER_UNAVAILABLE
PROVIDER_RATE_LIMITED
DUPLICATE_REQUEST
INTERNAL_ERROR
```

## 15. API evolution

Breaking API changes require a version bump or explicit migration plan. Shared schemas should live in `packages/contracts` and be imported by both API and web client.
