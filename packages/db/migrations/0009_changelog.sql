CREATE TABLE IF NOT EXISTS changelog_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT,
  type TEXT NOT NULL DEFAULT 'improvement' CHECK (type IN ('feature', 'improvement', 'fix', 'breaking')),
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_changelog_project ON changelog_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_changelog_published ON changelog_entries(project_id, published, published_at DESC);
