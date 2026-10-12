-- Simulated builder-fee ledger.
--
-- Every mock (simulated) execution accrues one hypothetical builder-fee row:
-- 5 bps on sizeUsd x leverage, split 50/50 creator/protocol. Live
-- executions never write here — no real fees are charged by PASS. Every
-- surface reading this table must label its numbers simulated.
CREATE TABLE fee_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  pass_id UUID NOT NULL REFERENCES passes(id),
  creator_user_id UUID REFERENCES users(id),
  notional_usd NUMERIC(24,8) NOT NULL,
  fee_usd NUMERIC(24,8) NOT NULL,
  creator_share_usd NUMERIC(24,8) NOT NULL,
  protocol_share_usd NUMERIC(24,8) NOT NULL,
  builder_fee_bps INTEGER NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON fee_ledger (creator_user_id);
CREATE INDEX ON fee_ledger (pass_id);
