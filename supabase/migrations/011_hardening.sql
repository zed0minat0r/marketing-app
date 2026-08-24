-- =============================================
-- Migration 011 - Audit hardening
-- =============================================

-- B1: the photo bucket must be reproducible from migrations, not a hand step.
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-photos', 'customer-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- S6: RLS on the three new tables, matching the project convention (006).
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON waitlist;
CREATE POLICY "Service role full access" ON waitlist
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE comment_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON comment_replies;
CREATE POLICY "Service role full access" ON comment_replies
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE review_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON review_replies;
CREATE POLICY "Service role full access" ON review_replies
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
