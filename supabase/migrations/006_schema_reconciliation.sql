-- =============================================
-- Migration 006 - Schema reconciliation
-- =============================================
-- schema.sql and migrations 001-004 diverged: neither alone produces a
-- working database. This migration brings a migrations-based database up to
-- everything the CODE actually reads and writes. Idempotent - safe to run on
-- a database built from either file.

-- Brand-voice / customization columns (commits b03c71d, 40e9ba2)
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_notes    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS assistant_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emoji_level    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_words   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hashtags       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cta_text       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cta_link       TEXT;

-- Referral system columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code           TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS queue_position          INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count          INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_reward_claimed BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_referral_code  ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_queue_position ON users(queue_position);

-- SMS opt-out column (from migration 004; repeated here in case the database
-- was built from schema.sql, which lacks it)
ALTER TABLE users ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_opted_out
  ON users(opted_out_at) WHERE opted_out_at IS NOT NULL;

-- Referrals table
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
DROP POLICY IF EXISTS "Service role full access" ON referrals;
CREATE POLICY "Service role full access" ON referrals
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Every DB function the code calls via supabase.rpc()
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
