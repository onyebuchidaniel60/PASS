-- Mark mock/simulated executions so a demo can never be confused with a real trade.
-- See docs/DATA_MODEL.md §2 (executions.simulated) and Task 1 Stage F closure.
--
-- Why a column and not a prefix sniff: the providerOrderId prefix (mock_<uuid>)
-- is a display convention; the boolean is the queryable truth. Both are set
-- together by the mock relay branches.
ALTER TABLE executions
  ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT false;
