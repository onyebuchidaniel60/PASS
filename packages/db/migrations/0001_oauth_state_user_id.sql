-- Bind an OAuth state to the PASS account that started the flow.
--
-- Why: /auth/x/start must NOT require a session (it is the entry point for a
-- brand-new user), so when one IS present we record it here. The callback then
-- knows which account to attach X to even though the redirect may have dropped
-- the session cookie.
--
-- This is deliberately a NEW column rather than reusing `redirect_to`. That
-- column is named for a post-login destination path; storing a user id in it
-- would read as a URL to the next person who touched this table, and the two
-- have completely different lifetimes.
ALTER TABLE oauth_states
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;