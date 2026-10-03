-- PASS initial schema.
-- Source of truth: docs/DATA_MODEL.md, plus docs/DECISIONS.md D-018.4/.5/.6.
-- Applied identically to real PostgreSQL and to embedded PGlite.

-- Enum types are created idempotently so re-running is safe.
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provider AS ENUM ('hyperliquid', 'ethos', 'x');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE identity_provider AS ENUM ('x', 'ethos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE direction AS ENUM ('long', 'short');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE entry_type AS ENUM ('market', 'limit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pass_status AS ENUM (
    'draft', 'active', 'entry_pending', 'open', 'tp_hit', 'sl_hit',
    'manually_closed', 'expired', 'cancelled', 'invalidated'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status user_status NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  slug text NOT NULL UNIQUE,
  handle text,
  name text NOT NULL,
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profiles_slug_idx ON profiles(slug);

CREATE TABLE IF NOT EXISTS identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider identity_provider NOT NULL,
  provider_subject_id text NOT NULL,
  username text,
  display_name text,
  avatar_url text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS identities_provider_subject_idx
  ON identities(provider, provider_subject_id);
CREATE INDEX IF NOT EXISTS identities_user_idx ON identities(user_id);

CREATE TABLE IF NOT EXISTS x_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  x_user_id text NOT NULL UNIQUE,
  x_handle text NOT NULL,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS x_connections_x_user_idx ON x_connections(x_user_id);

CREATE TABLE IF NOT EXISTS trading_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider provider NOT NULL DEFAULT 'hyperliquid',
  account_address text NOT NULL,
  agent_address text,
  agent_approved_at timestamptz,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS trading_accounts_provider_address_idx
  ON trading_accounts(provider, account_address);
CREATE INDEX IF NOT EXISTS trading_accounts_user_idx ON trading_accounts(user_id);

CREATE TABLE IF NOT EXISTS passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL UNIQUE,
  trader_id uuid NOT NULL REFERENCES users(id),
  slug text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  asset text NOT NULL,
  dex text,
  direction direction NOT NULL,
  entry_type entry_type NOT NULL,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  leverage numeric,
  thesis text NOT NULL,
  status pass_status NOT NULL DEFAULT 'draft',
  valid_from timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- D-018.4: slug is unique per (trader_id, slug).
CREATE UNIQUE INDEX IF NOT EXISTS passes_trader_slug_idx ON passes(trader_id, slug);
CREATE INDEX IF NOT EXISTS passes_public_id_idx ON passes(public_id);
CREATE INDEX IF NOT EXISTS passes_status_published_idx ON passes(status, published_at);
CREATE INDEX IF NOT EXISTS passes_trader_created_idx ON passes(trader_id, created_at);

CREATE TABLE IF NOT EXISTS pass_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES passes(id),
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pass_versions_pass_version_idx
  ON pass_versions(pass_id, version);

CREATE TABLE IF NOT EXISTS pass_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES passes(id),
  pass_version integer,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users(id),
  metadata jsonb
);
CREATE INDEX IF NOT EXISTS pass_events_pass_at_idx ON pass_events(pass_id, event_at);

CREATE TABLE IF NOT EXISTS executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES passes(id),
  pass_version integer NOT NULL,
  taker_user_id uuid NOT NULL REFERENCES users(id),
  account_id uuid NOT NULL REFERENCES trading_accounts(id),
  client_request_id text NOT NULL UNIQUE,
  provider_order_id text,
  provider_status text NOT NULL DEFAULT 'unknown',
  side text NOT NULL,
  position_size numeric NOT NULL,
  leverage numeric,
  requested_entry numeric,
  actual_entry numeric,
  stop_loss numeric,
  take_profit numeric,
  status pass_status NOT NULL DEFAULT 'entry_pending',
  opened_at timestamptz,
  closed_at timestamptz,
  realized_pnl numeric,
  fees numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS executions_taker_created_idx ON executions(taker_user_id, created_at);
CREATE INDEX IF NOT EXISTS executions_pass_created_idx ON executions(pass_id, created_at);
CREATE INDEX IF NOT EXISTS executions_provider_order_idx ON executions(provider_order_id);

CREATE TABLE IF NOT EXISTS ethos_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id),
  provider_profile_id text,
  credibility_score numeric,
  reviews_count integer,
  vouches_count integer,
  human_verified boolean,
  source_url text,
  synced_at timestamptz,
  raw_summary jsonb
);
CREATE INDEX IF NOT EXISTS ethos_profiles_provider_idx ON ethos_profiles(provider_profile_id);

CREATE TABLE IF NOT EXISTS follows (
  follower_user_id uuid NOT NULL REFERENCES users(id),
  followed_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_user_id, followed_user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL,
  payload jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  redirect_to text,
  code_verifier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(expires_at);