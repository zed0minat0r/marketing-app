-- =============================================
-- Migration 009 - FB/IG comment replies (draft -> owner approves by text)
-- =============================================
CREATE TABLE IF NOT EXISTS comment_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,             -- facebook | instagram
  comment_id      TEXT NOT NULL UNIQUE,      -- Graph comment id (dedupe key)
  commenter_name  TEXT,
  comment_text    TEXT,
  draft_reply     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','posted','skipped','failed')),
  posted_reply_id TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comment_replies_user ON comment_replies(user_id, status, created_at);
