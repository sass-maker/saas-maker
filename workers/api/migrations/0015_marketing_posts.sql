CREATE TABLE IF NOT EXISTS marketing_posts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_slug TEXT,
  channel TEXT NOT NULL DEFAULT 'x',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','exported','posted','archived')),
  title TEXT NOT NULL,
  hook TEXT,
  body TEXT NOT NULL,
  cta TEXT,
  asset_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','task','changelog')),
  source_id TEXT,
  task_id TEXT,
  changelog_entry_id TEXT,
  scheduled_for TEXT,
  exported_at TEXT,
  posted_at TEXT,
  result_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_owner_status ON marketing_posts(owner_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_owner_project ON marketing_posts(owner_id, project_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_source ON marketing_posts(owner_id, source_type, source_id, channel);
