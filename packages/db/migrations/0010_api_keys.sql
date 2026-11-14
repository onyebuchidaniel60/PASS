-- Agent API keys.
--
-- Only the SHA-256 hash of a key is stored. The plaintext key is returned once
-- by POST /api/v1/agent/keys and is never persisted or logged.
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- The hash is the lookup key for bearer authentication.
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);

-- Settings lists one user's active keys, newest first.
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);
