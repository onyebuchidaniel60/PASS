-- D-026: the Taker does not need a PASS account. A signed-out visitor takes
-- with their wallet; the wallet address on the trading account row is the
-- Taker's identity for that execution.
--
-- No new columns, no constraint changes, no FK drops. Existing rows keep
-- their user attribution; only new anonymous rows carry NULL.
ALTER TABLE trading_accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE executions ALTER COLUMN taker_user_id DROP NOT NULL;
