-- Analytics upgrade: bot detection, OS, sessions, pathname
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS pathname TEXT;

-- Index for bot filtering (most queries filter on is_bot)
CREATE INDEX IF NOT EXISTS idx_analytics_events_bot ON analytics_events(project_id, is_bot, created_at);
-- Index for session-based queries (bounce rate)
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(project_id, session_id);
