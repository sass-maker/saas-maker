CREATE TABLE IF NOT EXISTS droid_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  project_slug TEXT,
  repo_url TEXT,
  branch TEXT,
  command TEXT NOT NULL,
  cwd TEXT,
  sandbox_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
  exit_code INTEGER,
  duration_ms INTEGER,
  summary TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS droid_run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES droid_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'droid',
  source TEXT NOT NULL DEFAULT 'worker',
  message TEXT,
  command TEXT,
  cwd TEXT,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS droid_run_artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES droid_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  uri TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_droid_runs_task_created ON droid_runs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_droid_runs_project_created ON droid_runs(project_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_droid_run_events_run_created ON droid_run_events(run_id, created_at);
