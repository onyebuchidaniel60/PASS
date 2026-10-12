-- Soft unlink: swapping wallets must not delete execution history.
--
-- Unlinking a trading account used to hard-delete its row, which forced a
-- 403 guard on rows with executions (D-008). The row now survives with
-- is_active = false; the user's "current wallet" is the single active row.
-- History keeps its FK target, and unlink is never blocked.
--
-- Existing rows stay active: every row predates the flag and represents a
-- linked wallet.
ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
