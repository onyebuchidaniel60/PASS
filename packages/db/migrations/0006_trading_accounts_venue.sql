-- Per-venue agent approvals.
--
-- An approveAgent approval is venue-scoped: a mainnet approval means
-- nothing on testnet (Hyperliquid answers "User or API Wallet … does not
-- exist") and a mock approval was never sent anywhere. The API presents a
-- stored agentAddress only when its venue matches the current one, so a
-- stale approval reads as not-approved and the client re-prompts instead
-- of signing against a void approval.
--
-- Existing rows predate venue tracking: default 'mock' (fail closed). A
-- genuinely live approval re-presents after one re-approval on the current
-- venue; a mock one never leaks into a live venue.
ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS venue text NOT NULL DEFAULT 'mock';
