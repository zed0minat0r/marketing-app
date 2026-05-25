-- =============================================
-- Migration 003 — Photo enhancement (auto-upscale/sharpen)
-- =============================================

-- Add enhanced-version columns to customer_photos. Each photo keeps both the
-- original and the enhanced version; either can be served independently.
ALTER TABLE customer_photos
  ADD COLUMN IF NOT EXISTS enhanced_r2_key      TEXT,
  ADD COLUMN IF NOT EXISTS enhanced_url         TEXT,
  ADD COLUMN IF NOT EXISTS enhancement_status   TEXT DEFAULT 'pending'
    CHECK (enhancement_status IN ('pending', 'enhanced', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS enhancement_provider TEXT,                     -- 'replicate' | 'fal' | ...
  ADD COLUMN IF NOT EXISTS enhancement_model    TEXT;                     -- e.g. "real-esrgan"

CREATE INDEX IF NOT EXISTS idx_customer_photos_enh_status
  ON customer_photos(enhancement_status)
  WHERE enhancement_status = 'pending';

-- User-level toggle (default ON — Mike's photos get magazine-quality polish
-- automatically). When false, only the original is stored.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auto_enhance_enabled BOOLEAN DEFAULT TRUE;
