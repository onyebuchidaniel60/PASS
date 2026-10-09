-- Record first-time tour completion on the profile (docs/DECISIONS.md D-022).
--
-- Why a column on profiles and not a new table: tour state is a single
-- nullable timestamp per user with no relations of its own. A dedicated
-- table would be a join for one scalar. NULL means "never completed";
-- Settings replays the tour by resetting it to NULL.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz;
