-- =============================================
-- Migration 004 — SMS Compliance (STOP/HELP)
-- =============================================

-- When a user texts STOP / UNSUBSCRIBE / CANCEL / END / QUIT / STOPALL / OPTOUT
-- we set opted_out_at to NOW(). All future SMS sends are blocked while this is
-- non-null. Texting START / UNSTOP / YES clears it.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_opted_out
  ON users(opted_out_at)
  WHERE opted_out_at IS NOT NULL;
