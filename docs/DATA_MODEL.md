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
user_id UUID FK users.id
provider enum(hyperliquid)
account_address text
agent_address text nullable
is_primary boolean
created_at timestamptz
updated_at timestamptz
UNIQUE(provider, account_address)
```

`account_address` is queried for account state. `agent_address` is a signer and must never be treated as the account itself.

### passes

```text
id UUID PK
public_id text UNIQUE
trader_id UUID FK users.id
slug text
version integer
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
```

### pass_versions

If versioning is implemented as separate immutable rows, store the complete executable plan snapshot here.

```text
id UUID PK
pass_id UUID FK passes.id
version integer
snapshot jsonb
created_at timestamptz
created_by UUID FK users.id
UNIQUE(pass_id, version)
```

The implementation must choose either versioned rows or equivalent append-only snapshots, but historical execution must always resolve to a deterministic plan snapshot.

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

```text
id UUID PK
pass_id UUID FK passes.id
pass_version integer
taker_user_id UUID FK users.id
account_id UUID FK trading_accounts.id
client_request_id text UNIQUE
provider_order_id text nullable
provider_status text
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

### ethos_profiles

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
