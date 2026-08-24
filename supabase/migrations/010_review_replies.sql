-- =============================================
-- Migration 010 - Google review replies (draft -> owner approves by text)
-- =============================================
CREATE TABLE IF NOT EXISTS review_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id       TEXT NOT NULL UNIQUE,      -- full GBP review resource name
  location_name   TEXT,                      -- accounts/{a}/locations/{l}
  reviewer_name   TEXT,
  star_rating     INT,
  review_text     TEXT,
  draft_reply     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','posted','skipped','failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_replies_user ON review_replies(user_id, status, created_at);
