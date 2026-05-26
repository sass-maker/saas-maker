-- Add agent-handoff metadata fields to changelog_entries
ALTER TABLE changelog_entries ADD COLUMN source TEXT;
ALTER TABLE changelog_entries ADD COLUMN task_id TEXT;
ALTER TABLE changelog_entries ADD COLUMN agent TEXT;
ALTER TABLE changelog_entries ADD COLUMN evidence TEXT;

CREATE INDEX idx_changelog_date ON changelog_entries(project_id, date(created_at));
CREATE INDEX idx_changelog_source ON changelog_entries(project_id, source);
