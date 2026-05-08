CREATE TABLE IF NOT EXISTS symphony_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  project_slug TEXT,
  agent_profile TEXT,
  model_profile TEXT,
  command_template TEXT NOT NULL,
  pid INTEGER,
  status TEXT NOT NULL DEFAULT 'started',
  workspace_path TEXT,
  prompt_path TEXT,
  terminal_hint TEXT,
  log_hint TEXT,
  cost_note TEXT,
  token_note TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_symphony_runs_owner_started ON symphony_runs(owner_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_symphony_runs_task_started ON symphony_runs(task_id, started_at DESC);
