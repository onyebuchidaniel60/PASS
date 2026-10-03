# PASS — Technical Specification

**Version:** 1.0 draft
**Status:** Source of truth
**Last reviewed:** 2026-10-03

## 1. Architecture principles

- web-first full product;
- one-shot complete initial build;
- modular provider integrations;
- non-custodial user-controlled execution;
- append-only Pass lifecycle events;
- server-authoritative validation;
- explicit external-provider boundaries;
- observability from day one;
- deploy early enough to expose real integration/UX issues.

## 2. High-level architecture

```text
                         X
                discovery / distribution
                         |
                         v
+--------------------------------------------------+
|                     PASS                         |
|                                                  |
|  Web UI  <->  API  <->  PostgreSQL              |
|               |                                  |
|      +--------+---------+---------+              |
|      |                  |         |              |
|      v                  v         v              |
| Hyperliquid            Ethos     X API           |
| market/execution       identity   posting        |
+--------------------------------------------------+
               ^
               |
        Chrome Extension
        (X discovery layer)
```

## 3. Recommended monorepo

```text
apps/
  web/                # PASS web application
  api/                # HTTP API
  worker/             # lifecycle/market/analytics jobs
  extension/          # Chrome Manifest V3 extension
packages/
  domain/             # pure domain logic and types
  db/                 # schema/migrations/repositories
  contracts/          # API schemas and shared DTOs
  integrations/       # provider adapters
  ui/                 # shared UI components if useful
  config/             # shared TS/lint/build configuration

docs/
  ...
```

A simpler single Next.js app is acceptable for early scaffolding, but the domain and integration boundaries must remain clean.

## 4. Technology defaults

### Web

- Next.js + TypeScript
- Tailwind CSS
- component system such as shadcn/ui
- React Query/TanStack Query or equivalent for server state
- Zod for input validation

### API

Preferred: Fastify + TypeScript.

The API should expose domain-level endpoints and keep provider-specific payloads out of frontend contracts.

### Database

PostgreSQL.

### ORM

Drizzle ORM.

### Jobs

A lightweight worker is sufficient for MVP. Use Postgres-backed jobs, cron, or equivalent rather than introducing unnecessary distributed infrastructure.

### Hosting

- Vercel for web frontend;
- managed PostgreSQL;
- managed backend/worker host such as Railway/Render/Fly;
- object storage only if media becomes necessary.

## 5. Runtime environments

At minimum:

- local;
- preview;
- production.

Do not use production trading credentials/agent keys for local development.

## 6. Integration boundaries

### Hyperliquid adapter

```text
src/integrations/hyperliquid/
  client.ts
  info.ts
  exchange.ts
  market-data.ts
  account-data.ts
  orders.ts
  positions.ts
  fills.ts
  signing.ts
  types.ts
```

### Ethos adapter

```text
src/integrations/ethos/
  client.ts
  profiles.ts
  reputation.ts
  identity.ts
  types.ts
```

### X adapter

```text
src/integrations/x/
  oauth.ts
  users.ts
  posts.ts
  types.ts
```

## 7. Hyperliquid architecture

Hyperliquid currently documents API wallets (also called agent wallets) as wallets a master account can approve to sign on behalf of the master or subaccounts. The API-wallet signer is distinct from the master account whose account data is queried. See `docs/INTEGRATION_VERIFICATION.md` for the verified references.

### PASS design

1. User connects their master wallet.
2. PASS generates a fresh agent/API wallet in the user's trusted client context.
3. User approves that agent/API wallet through Hyperliquid's `approveAgent` action.
4. The agent private key remains client-controlled and is not persisted by the PASS backend.
5. For a trade, the client creates/signs the Hyperliquid L1 action through the official/current SDK/signing method.
6. The client sends the signed request to the PASS API, which validates and relays it to the Hyperliquid Exchange API. The server-relay path is the only supported path in the MVP (see `docs/DECISIONS.md` D-018.3).
7. PASS tracks the order using order status and user/account queries.

The precise browser wallet connector and SDK package should be selected during implementation from the current official Hyperliquid ecosystem documentation; do not hard-code a package name based solely on this document.

## 8. Why the backend must not query the agent address

Hyperliquid documents that API wallets are only signers. Account data associated with the master/subaccount must be queried with the actual account address, otherwise the result may appear empty.

PASS therefore stores both:

- `account_address` — the trading account whose state is queried;
- `agent_address` — the signer used for authorized actions.

Never substitute one for the other.

## 9. Market data

Use Hyperliquid Info API for:

- market metadata;
- mids/prices;
- order-book data where required;
- user account state;
- open orders;
- fills;
- historical/account data.

Use WebSocket where live updates materially improve UX or lifecycle monitoring.

## 10. Order handling

The backend must be capable of validating and tracking:

- order intent;
- pass version;
- user-selected size;
- current market snapshot;
- order submission;
- Hyperliquid order ID;
- fill status;
- trigger/TP/SL state where used.

Each execution attempt receives an internal idempotency key.

## 11. State management

The server is authoritative for:

- Pass lifecycle;
- execution records;
- user/account association;
- analytics aggregates;
- provider synchronization status.

The client is authoritative for:

- transient signing state;
- local UI state;
- client-held agent key material.

## 12. Web/API request flow

```text
Browser
  -> API: get Pass
  -> API: validate Pass
  -> Browser: render review
  -> Browser: create signed action
  -> API: submit/relay signed request
  -> Hyperliquid
  -> API: verify result / sync
  -> DB: execution + events
  -> Browser: confirmation
```

## 13. Idempotency

Execution endpoints must require or derive an idempotency key bound to:

- taker;
- pass version;
- intended execution;
- client-generated request ID.

A retried request must not unintentionally create duplicate orders.

## 14. Caching

Cache only data whose staleness is acceptable.

Recommended:

- market metadata: minutes/hours;
- Ethos reputation: short TTL with explicit `lastSyncedAt`;
- public profile aggregates: short TTL;
- current order/position status: near-real-time or on-demand;
- execution confirmation: never rely on stale cache as final truth.

## 15. Background jobs

Required initial jobs:

1. Pass expiry/state reconciliation;
2. order/execution reconciliation;
3. performance aggregation;
4. Ethos profile refresh where appropriate;
5. stale-data cleanup.

## 16. Observability

Capture structured events for:

- auth failures;
- provider API failures;
- Pass creation/update;
- execution intent;
- order submission;
- order result;
- lifecycle transition;
- extension API failures;
- deployment build failures.

Never log secret material.

## 17. Error model

This list is illustrative. `docs/API_CONTRACTS.md` §14 is the authoritative error-code list.

Return stable application error codes, for example:

```text
AUTH_REQUIRED
PROFILE_NOT_FOUND
PASS_NOT_FOUND
PASS_EXPIRED
PASS_CANCELLED
PASS_VERSION_STALE
MARKET_UNAVAILABLE
INVALID_POSITION_SIZE
INSUFFICIENT_MARGIN
INVALID_LEVERAGE
SLIPPAGE_EXCEEDED
SIGNATURE_REJECTED
ORDER_REJECTED
PROVIDER_UNAVAILABLE
RATE_LIMITED
```

## 18. Performance targets

Initial practical targets:

- public Pass page first useful render: < 2.5s on a normal broadband connection;
- API p95 for simple reads: < 400ms excluding external-provider latency;
- execution preview: < 1.5s where provider data is cached/live;
- no unbounded polling in the browser;
- extension overlay should not noticeably block X rendering.

Targets are engineering goals, not product promises.
