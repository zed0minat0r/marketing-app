-- 012_monitoring.sql
-- Error capture + alert dedupe state. The admin dashboard has read an
-- `errors` table since day one, but no DDL ever created it and nothing ever
-- wrote to it - the flagship silent failure. This makes both real.

CREATE TABLE IF NOT EXISTS errors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source      TEXT NOT NULL,              -- e.g. 'sms-inbound', 'job:publish'
  message     TEXT NOT NULL,
  stack       TEXT,
  context     JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id     UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS errors_created_at_idx ON errors (created_at DESC);
CREATE INDEX IF NOT EXISTS errors_source_idx ON errors (source);

-- One row per alert key; used to send at most one alert per key per window.
CREATE TABLE IF NOT EXISTS alert_state (
  key               TEXT PRIMARY KEY,
  last_sent_at      TIMESTAMPTZ,
  suppressed_count  INTEGER NOT NULL DEFAULT 0
);

-- Service-role only, like 011: RLS on with no policies.
ALTER TABLE errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_state ENABLE ROW LEVEL SECURITY;
