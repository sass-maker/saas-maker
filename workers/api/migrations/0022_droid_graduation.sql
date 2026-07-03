-- Droid graduation: durable retry/timeout contracts + pre-flight + success dashboard.
-- Adds explicit retry_count and categorized failure_reason columns to droid_runs so the
-- 7-day success-rate dashboard can be computed with cheap indexed queries instead of
-- scanning every run event row.

ALTER TABLE droid_runs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE droid_runs ADD COLUMN failure_reason TEXT;

-- Index the created_at column so the rolling 7-day window query is fast even as the
-- droid_runs table grows. The existing idx_droid_runs_* indexes cover task/project
-- lookups but not the time-bounded dashboard scan.
CREATE INDEX IF NOT EXISTS idx_droid_runs_created_at ON droid_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_droid_runs_status_created ON droid_runs(status, created_at DESC);
