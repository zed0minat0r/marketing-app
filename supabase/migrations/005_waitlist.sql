-- =============================================
-- Migration 005 — Waitlist signups
-- =============================================

-- Landing-page signups. One row per phone number (repeat signups upsert).
-- consent_language snapshots the exact checkbox text the person agreed to,
-- alongside consent_at, as TCPA opt-in evidence.
CREATE TABLE IF NOT EXISTS waitlist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL,
  phone            TEXT NOT NULL,              -- E.164: +14845551234
  sms_consent      BOOLEAN NOT NULL DEFAULT FALSE,
  consent_language TEXT,
  consent_at       TIMESTAMPTZ DEFAULT NOW(),
  plan             TEXT,                       -- starter, growth, pro (interest only)
  referral_code    TEXT,                       -- this signup's own shareable code
  referred_by      TEXT,                       -- ?ref= code that brought them here
  source           TEXT DEFAULT 'landing',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_phone ON waitlist(phone);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(lower(email));
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at);
