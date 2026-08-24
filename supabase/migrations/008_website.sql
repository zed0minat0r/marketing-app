-- Migration 008 - business website (for the website-audit command and future audits)
ALTER TABLE users ADD COLUMN IF NOT EXISTS website TEXT;
