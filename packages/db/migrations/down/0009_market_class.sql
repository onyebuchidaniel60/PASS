-- Reverse 0009. Destructive only because the columns did not exist before;
-- no other table or constraint depends on them.
ALTER TABLE passes DROP CONSTRAINT IF EXISTS passes_market_class_check;
ALTER TABLE passes DROP COLUMN IF EXISTS outcome_name;
ALTER TABLE passes DROP COLUMN IF EXISTS market_class;
