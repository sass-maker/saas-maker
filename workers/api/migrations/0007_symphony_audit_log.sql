CREATE TABLE IF NOT EXISTS symphony_audit_log (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_source TEXT NOT NULL DEFAULT 'api',
  agent_profile TEXT,
  project_slug TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_symphony_audit_owner_created ON symphony_audit_log(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_symphony_audit_task_created ON symphony_audit_log(task_id, created_at DESC);
