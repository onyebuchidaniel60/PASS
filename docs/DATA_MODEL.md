# PASS — Data Model

## 1. Modeling principles

- PostgreSQL is the system of record for PASS-owned state.
- External provider IDs are stored alongside PASS IDs.
- Public identities and private execution state are separated.
- Published Pass history is reconstructable.
- Raw provider payloads are not the primary domain model.
- Sensitive credentials are never persisted in plaintext.

## 2. Core entities

### users

```text
id UUID PK
created_at timestamptz
updated_at timestamptz
status enum(active, suspended, deleted)
```

### profiles

```text
id UUID PK
user_id UUID UNIQUE FK users.id
slug text UNIQUE
handle text
name text
bio text
avatar_url text
created_at timestamptz
updated_at timestamptz
```

### identities

Public identity binding — one row per provider per user. Holds the provider subject id, username, display name, and avatar. This table is public-facing and carries no secret material (see `docs/DECISIONS.md` D-018.6).

One user can have one identity per provider.

```text
id UUID PK
user_id UUID FK users.id
provider enum(x, ethos)
provider_subject_id text
username text nullable
display_name text nullable
avatar_url text nullable
metadata jsonb
created_at timestamptz
updated_at timestamptz
UNIQUE(provider, provider_subject_id)
```

### trading_accounts

```text
id UUID PK
user_id UUID FK users.id NULLABLE (D-026)
provider enum(hyperliquid)
account_address text
agent_address text nullable
is_primary boolean
is_active boolean NOT NULL DEFAULT true
venue text NOT NULL DEFAULT 'mock'
created_at timestamptz
updated_at timestamptz
UNIQUE(provider, account_address)
```

`account_address` is queried for account state. `agent_address` is a signer and must never be treated as the account itself.

`is_active` is the soft-unlink flag (migration `0005_trading_accounts_is_active.sql`).
The user's current wallet is the single active row. Unlinking sets
`is_active = false` and never deletes the row, so execution history keeps
its `executions.account_id` FK target (D-008) and unlink is never blocked —
not even when executions reference the row. Linking a new address retires
the previous active rows; re-linking the same address reactivates it.
`GET /me` (and every other consumer of `getTradingAccounts`) returns only
active rows; inactive rows are internal history.

`venue` is the venue the stored agent approval belongs to (`mainnet`,
`testnet`, or `mock`; migration `0006_trading_accounts_venue.sql`,
pre-existing rows default `mock` — fail closed). Approvals are
venue-scoped: the API presents `agent_address` only when it matches the
current venue, so a mainnet (or mock) approval reads as not-approved on
testnet and the client re-prompts `approveAgent` instead of signing
against a void approval. The row is untouched, so flipping venues back
restores the earlier approval with no action needed.

D-026: `user_id` is nullable. An anonymous wallet may own a trading
account row keyed only by `(provider, account_address)` — the row is the
execution target for signed-out Takes and is never reassigned to another
user. A signed-in user's rows keep their `user_id`; sessionless access
is allowed only to rows with `user_id IS NULL`.

### passes

```text
id UUID PK
public_id text UNIQUE
trader_id UUID FK users.id
slug text
version integer  -- Current published version. Historical versions live in pass_versions.
asset text
dex text nullable
direction enum(long, short)
entry_type enum(market, limit)
entry_price numeric nullable
stop_loss numeric nullable
take_profit numeric nullable
leverage numeric nullable
thesis text
status enum(draft, active, entry_pending, open, tp_hit, sl_hit, manually_closed, expired, cancelled, invalidated)
valid_from timestamptz
expires_at timestamptz nullable
published_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
UNIQUE(trader_id, slug)
```

### pass_versions

Immutable snapshots of every execution-relevant Pass version. Store the complete executable plan snapshot here.

```text
id UUID PK
pass_id UUID FK passes.id
version integer
snapshot jsonb
created_at timestamptz
created_by UUID FK users.id
UNIQUE(pass_id, version)
```

`passes` holds the current working/published state. `pass_versions` holds immutable snapshots of every execution-relevant version. Every execution references `(pass_id, pass_version)`, and that pair must always resolve in `pass_versions`, regardless of later Pass edits. Editing an execution-relevant field on a live Pass creates a new `pass_versions` row and a `pass_events` row before the change is visible on the public page.

### pass_events

```text
id UUID PK
pass_id UUID FK passes.id
pass_version integer nullable
event_type text
event_at timestamptz
actor_user_id UUID nullable FK users.id
metadata jsonb
```

### executions

References a specific `(pass_id, pass_version)`; historical execution must remain reproducible after later Pass edits.

```text
id UUID PK
pass_id UUID FK passes.id
pass_version integer
taker_user_id UUID FK users.id NULLABLE (D-026)
account_id UUID FK trading_accounts.id
client_request_id text UNIQUE
provider_order_id text nullable
provider_status text
simulated boolean NOT NULL DEFAULT false
side text
position_size numeric
leverage numeric nullable
requested_entry numeric nullable
actual_entry numeric nullable
stop_loss numeric nullable
take_profit numeric nullable
opened_at timestamptz nullable
closed_at timestamptz nullable
realized_pnl numeric nullable
fees numeric nullable
created_at timestamptz
updated_at timestamptz
```

`simulated` is true when the execution was produced by the mock relay
(`HYPERLIQUID_MODE=mock`). The mock relay returns a synthetic
`providerOrderId` of the form `mock_<uuid>` with status `pending` and makes
no network call to Hyperliquid. A simulated row is a demo, never a real
trade: the Take receipt and the Executions page must render a "SIMULATED"
marker inline with the provider order id. Live relays set `simulated: false`.
Added by migration `0003_executions_simulated.sql` (Stage F closure).

D-026: `taker_user_id` is nullable. An anonymous (signed-out) Take writes
`NULL` — the wallet address on the referenced `trading_accounts` row is the
Taker's identity for that execution. `GET /me/executions` returns only rows
for the signed-in user; anonymous rows never appear there and are never
retroactively attached to a user who signs in later.

### fee_ledger

One simulated builder-fee row per mock execution: 5 bps on
`sizeUsd x leverage`, split 50/50 creator/protocol (`packages/domain/fees.ts`).

```text
id UUID PK
execution_id UUID FK executions.id ON DELETE CASCADE
pass_id UUID FK passes.id
creator_user_id UUID nullable FK users.id
notional_usd numeric(24,8)
fee_usd numeric(24,8)
creator_share_usd numeric(24,8)
protocol_share_usd numeric(24,8)
builder_fee_bps integer
simulated boolean NOT NULL DEFAULT true
created_at timestamptz
```

Live executions never write here — no real fees are charged by PASS. Every
surface reading this table (Take receipt, My Passes) must label its numbers
simulated. Added by migration `0007_fee_ledger.sql`.

### ethos_profiles

Cached Ethos reputation snapshot, refreshed periodically. Read-only from the public API (see `docs/DECISIONS.md` D-018.6).

```text
id UUID PK
user_id UUID UNIQUE FK users.id
provider_profile_id text
credibility_score numeric nullable
reviews_count integer nullable
vouches_count integer nullable
human_verified boolean nullable
source_url text nullable
synced_at timestamptz
raw_summary jsonb nullable
```

Do not treat `credibility_score` as an absolute trust verdict.

### x_connections

X OAuth token material. Encrypted at rest. Never exposed publicly, never returned by any public endpoint (see `docs/DECISIONS.md` D-018.6).

A user may have an `identities` row for X without an `x_connections` row — for example, display-only identity linking without OAuth tokens.

```text
id UUID PK
user_id UUID UNIQUE FK users.id
x_user_id text UNIQUE
x_handle text
access_token_encrypted text nullable
refresh_token_encrypted text nullable
token_expires_at timestamptz nullable
scopes text[] nullable
created_at timestamptz
updated_at timestamptz
```

Encryption/key management must follow `SECURITY_SPEC.md`.

### follows

Optional MVP-later entity.

```text
follower_user_id UUID FK users.id
followed_user_id UUID FK users.id
created_at timestamptz
PRIMARY KEY(follower_user_id, followed_user_id)
```

### notifications

```text
id UUID PK
user_id UUID FK users.id
type text
payload jsonb
read_at timestamptz nullable
created_at timestamptz
```

## 3. Integrity invariants

1. A Pass must belong to exactly one Trader.
2. A published Pass must have a valid version snapshot.
3. An execution must point to a specific Pass version.
4. Historical execution data must remain reproducible after later Pass updates.
5. The account address and agent address must be stored separately.
6. A Taker's position size is never derived from the Trader's portfolio size unless explicitly provided as informational only.
7. Cancelled/expired Passes cannot create new executions.
8. A terminal Pass state cannot silently return to active.
9. Duplicate execution requests with the same idempotency key must be safely rejected or return the original result.

## 4. Decimal handling

Use decimal/numeric types for financial quantities. Never use binary floating point for persisted financial values.

Provider values should be parsed and normalized at the integration boundary.

## 5. Indexing

Recommended indexes:

- profiles.slug;
- identities(provider, provider_subject_id);
- trading_accounts(provider, account_address);
- passes(status, published_at desc);
- passes(trader_id, created_at desc);
- passes(public_id);
- pass_events(pass_id, event_at desc);
- executions(taker_user_id, created_at desc);
- executions(pass_id, created_at desc);
- ethos_profiles(provider_profile_id);
- x_connections(x_user_id).

## 6. Deletion/retention

Published Passes and execution history are product records and should not be hard-deleted merely because a user updates their profile.

User-requested account deletion must follow a documented privacy-retention policy; financial/provider records may require retention for audit and operational reasons.
