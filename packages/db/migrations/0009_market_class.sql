-- HIP-4 additive market class.
--
-- Existing Passes were all Hyperliquid perps. The default backfills them
-- without touching a row: no data is rewritten, no Pass changes meaning.
-- outcome_name is the venue question captured at authoring time so Discover
-- and Pass detail do not need a live outcomeMeta call per read.
ALTER TABLE passes
  ADD COLUMN market_class TEXT NOT NULL DEFAULT 'perp';

ALTER TABLE passes
  ADD COLUMN outcome_name TEXT;

-- Cheap guard: a Pass is one of the market classes PASS can execute.
ALTER TABLE passes
  ADD CONSTRAINT passes_market_class_check
  CHECK (market_class IN ('perp', 'spot', 'hip4'));
