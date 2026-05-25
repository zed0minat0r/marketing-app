-- =============================================
-- Migration 002 — Customer Photos (MMS intake)
-- =============================================

-- =============================================
-- CUSTOMER_PHOTOS
-- =============================================
CREATE TABLE IF NOT EXISTS customer_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  r2_key        TEXT NOT NULL,                                    -- e.g. "user_<uuid>/2026-05-25_abc.jpg"
  public_url    TEXT NOT NULL,                                    -- full URL for serving
  mime_type     TEXT NOT NULL,                                    -- image/jpeg, image/png, image/heic, image/webp
  file_size     INT,                                              -- bytes
  caption       TEXT,                                             -- SMS body that came with the photo
  tags          JSONB DEFAULT '[]'::jsonb,                        -- ["kitchen","white","finished_work"]
  tags_status   TEXT DEFAULT 'pending'
                CHECK (tags_status IN ('pending', 'tagged', 'failed')),
  source        TEXT DEFAULT 'sms'
                CHECK (source IN ('sms', 'web', 'api')),
  twilio_sid    TEXT,                                             -- inbound MessageSid for trace
  is_archived   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_photos_user_id ON customer_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_photos_user_created ON customer_photos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_photos_tags ON customer_photos USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_customer_photos_status ON customer_photos(tags_status) WHERE tags_status = 'pending';

-- RLS + service-role policy to match the rest of the schema
ALTER TABLE customer_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON customer_photos
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- updated_at trigger
CREATE TRIGGER customer_photos_updated_at
  BEFORE UPDATE ON customer_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- USER PREFERENCES for photo intake
-- =============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS confirm_photos_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_draft_on_photo    BOOLEAN,                      -- NULL = "not yet asked"
  ADD COLUMN IF NOT EXISTS first_photo_received_at TIMESTAMPTZ;
