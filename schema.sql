-- =============================================
-- TextMarketer Database Schema
-- Supabase (PostgreSQL)
-- All timestamps UTC, all IDs UUID
-- =============================================

-- Enable pgcrypto for token encryption and UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                   TEXT UNIQUE NOT NULL,          -- E.164 format: +14845551234
  business_name           TEXT,
  business_type           TEXT,                          -- restaurant, retail, service, ecommerce, other
  tone                    TEXT DEFAULT 'professional',   -- casual, professional, bold, friendly
  timezone                TEXT DEFAULT 'America/New_York',
  plan                    TEXT DEFAULT 'starter',        -- starter, growth, pro
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  referral_code           TEXT UNIQUE,                   -- 6-char alphanumeric, generated on signup
  queue_position          INT,                           -- waitlist position; lower = earlier access
  referral_count          INT DEFAULT 0,                 -- number of successful referral conversions
  referral_reward_claimed BOOLEAN DEFAULT FALSE,         -- true when 3+ referrals reward granted
  onboarding_complete     BOOLEAN DEFAULT FALSE,
  onboarding_step         TEXT DEFAULT 'name',           -- name, type, tone, done
  generations_used        INT DEFAULT 0,                 -- reset monthly
  generations_limit       INT DEFAULT 50,                -- per plan
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_queue_position ON users(queue_position);

-- =============================================
-- CONVERSATIONS (message log)
-- =============================================
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body        TEXT NOT NULL,
  intent      TEXT,              -- post, schedule, analytics, help, connect, cancel, approve, edit, onboarding, error
  twilio_sid  TEXT,              -- Twilio message SID
  claude_model TEXT,             -- which Claude model was used
  tokens_used INT,               -- Claude API tokens consumed
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations(user_id, created_at DESC);

-- Auto-delete messages older than 90 days (GDPR/CCPA compliance)
-- Run this as a scheduled job or use pg_cron if available
-- DELETE FROM conversations WHERE created_at < NOW() - INTERVAL '90 days';

-- =============================================
-- SOCIAL ACCOUNTS (OAuth connections)
-- =============================================
CREATE TABLE IF NOT EXISTS social_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,          -- facebook, instagram, twitter
  platform_user_id    TEXT NOT NULL,          -- platform-specific user/page ID
  platform_username   TEXT,                   -- display name (@mikespizza)
  access_token        TEXT NOT NULL,          -- store encrypted; use pgcrypto in production
  refresh_token       TEXT,                   -- store encrypted; use pgcrypto in production
  token_expires_at    TIMESTAMPTZ,
  scopes              TEXT[],                 -- granted OAuth scopes
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform, is_active);
CREATE INDEX IF NOT EXISTS idx_social_accounts_expires ON social_accounts(token_expires_at) WHERE is_active = TRUE;

-- =============================================
-- SCHEDULED POSTS
-- =============================================
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platforms         TEXT[] NOT NULL,                    -- ['instagram', 'facebook']
  content           TEXT NOT NULL,
  media_url         TEXT,                               -- optional image/video URL
  status            TEXT DEFAULT 'draft'
                    CHECK (status IN ('draft', 'queued', 'publishing', 'posted', 'failed', 'canceled')),
  scheduled_for     TIMESTAMPTZ,                        -- NULL = immediate
  qstash_message_id TEXT,                              -- for cancellation
  published_urls    JSONB DEFAULT '{}',                 -- {"instagram": "https://...", "facebook": "https://..."}
  error_message     TEXT,
  retry_count       INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_status ON scheduled_posts(user_id, status);

-- =============================================
-- ANALYTICS SNAPSHOTS (per-post metrics, nightly)
-- =============================================
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  impressions     INT DEFAULT 0,
  reach           INT DEFAULT 0,
  likes           INT DEFAULT 0,
  comments        INT DEFAULT 0,
  shares          INT DEFAULT 0,
  saves           INT DEFAULT 0,
  clicks          INT DEFAULT 0,
  raw_data        JSONB,             -- full API response
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, platform, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_post_id ON analytics_snapshots(post_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshot_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_analytics_platform ON analytics_snapshots(platform, snapshot_date);

-- =============================================
-- WEEKLY ANALYTICS (aggregated per user per week)
-- =============================================
CREATE TABLE IF NOT EXISTS weekly_analytics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start          DATE NOT NULL,               -- Monday of the week
  posts_count         INT DEFAULT 0,
  total_reach         INT DEFAULT 0,
  total_impressions   INT DEFAULT 0,
  total_engagement    INT DEFAULT 0,               -- likes + comments + shares
  top_post_id         UUID REFERENCES scheduled_posts(id),
  summary_text        TEXT,                        -- Claude-generated SMS summary
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_analytics_user_id ON weekly_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_analytics_week_start ON weekly_analytics(week_start);

-- =============================================
-- OAUTH STATES (CSRF protection, 15-min TTL)
-- =============================================
CREATE TABLE IF NOT EXISTS oauth_states (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  state       TEXT UNIQUE NOT NULL,           -- random string for CSRF (also packs PKCE verifier for Twitter)
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- =============================================
-- OAUTH LINKS (one-time SMS tokens for OAuth initiation)
-- =============================================
CREATE TABLE IF NOT EXISTS oauth_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,                   -- meta, twitter
  token       TEXT UNIQUE NOT NULL,            -- random token sent in SMS
  used        BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_links_token ON oauth_links(token);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_links ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by our API functions)
-- These policies allow the service role to do everything,
-- and users to see only their own data if accessed via anon key.

CREATE POLICY "Service role full access" ON users
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON conversations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON social_accounts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON scheduled_posts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON analytics_snapshots
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON weekly_analytics
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON oauth_states
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access" ON oauth_links
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- REFERRALS
-- =============================================
CREATE TABLE IF NOT EXISTS referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_email    TEXT,
  referred_phone    TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'converted')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_phone ON referrals(referred_phone);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON referrals
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Increment generations_used atomically
CREATE OR REPLACE FUNCTION increment_generations_used(user_id_input UUID)
RETURNS VOID AS $$
  UPDATE users
  SET generations_used = generations_used + 1,
      updated_at = NOW()
  WHERE id = user_id_input;
$$ LANGUAGE sql;

-- Reset all users' generation counts (run on 1st of each month)
CREATE OR REPLACE FUNCTION reset_monthly_generations()
RETURNS VOID AS $$
  UPDATE users
  SET generations_used = 0,
      updated_at = NOW();
$$ LANGUAGE sql;

-- Generate a unique 6-char alphanumeric referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS (SELECT 1 FROM users WHERE referral_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Assign queue position atomically (max + 1)
CREATE OR REPLACE FUNCTION assign_queue_position(user_id_input UUID)
RETURNS INT AS $$
DECLARE
  next_pos INT;
BEGIN
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO next_pos FROM users;
  UPDATE users SET queue_position = next_pos WHERE id = user_id_input;
  RETURN next_pos;
END;
$$ LANGUAGE plpgsql;

-- Credit referrer: increment referral_count, move queue up by 50
CREATE OR REPLACE FUNCTION credit_referrer(referrer_id_input UUID)
RETURNS TABLE(new_referral_count INT, new_queue_position INT, reward_claimed BOOLEAN) AS $$
DECLARE
  v_count INT;
  v_pos INT;
  v_reward BOOLEAN;
BEGIN
  UPDATE users
  SET
    referral_count = referral_count + 1,
    queue_position = GREATEST(1, COALESCE(queue_position, 9999) - 50),
    updated_at = NOW()
  WHERE id = referrer_id_input
  RETURNING referral_count, queue_position, referral_reward_claimed
  INTO v_count, v_pos, v_reward;

  -- Grant reward at 3 referrals (if not already claimed)
  IF v_count >= 3 AND NOT v_reward THEN
    UPDATE users
    SET
      queue_position = 1,
      referral_reward_claimed = TRUE,
      updated_at = NOW()
    WHERE id = referrer_id_input;
    v_pos := 1;
    v_reward := TRUE;
  END IF;

  RETURN QUERY SELECT v_count, v_pos, v_reward;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired OAuth states and links
CREATE OR REPLACE FUNCTION cleanup_expired_oauth()
RETURNS VOID AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
  DELETE FROM oauth_links WHERE expires_at < NOW() OR (used = TRUE AND created_at < NOW() - INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at on users
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scheduled_posts_updated_at
  BEFORE UPDATE ON scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
