-- =============================================
-- Migration 007 - Growth engine (adaptive loop)
-- =============================================

-- Rolling measured insights per user: what topics/formats/times actually
-- performed, computed weekly from analytics_snapshots. Shape:
-- { as_of, sample_size, top_topic, top_format, best_hour_local, best_post:
--   {content_preview, engagement}, avg_engagement }
ALTER TABLE users ADD COLUMN IF NOT EXISTS content_insights JSONB;

-- The single live experiment: { type: 'posting_time'|'format'|'topic',
--   variant, control, started_at, status }
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_experiment JSONB;

-- City for local-flavored copy (onboarding question lands later)
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;

-- Content tags assigned at generation time - the dimensions insights
-- aggregate over
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS topic  TEXT;
ALTER TABLE scheduled_posts ADD COLUMN IF NOT EXISTS format TEXT;
