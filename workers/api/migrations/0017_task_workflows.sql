CREATE TABLE IF NOT EXISTS task_workflows (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  project_slug TEXT,
  name TEXT NOT NULL,
  description TEXT,
  context_markdown TEXT NOT NULL DEFAULT '',
  prompt_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  last_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_workflows_owner_task ON task_workflows(owner_id, task_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_task_workflows_owner_project ON task_workflows(owner_id, project_slug, updated_at);
CREATE INDEX IF NOT EXISTS idx_task_workflows_owner_status ON task_workflows(owner_id, status, updated_at);

CREATE TABLE IF NOT EXISTS task_workflow_artifacts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES task_workflows(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  project_slug TEXT,
  run_id TEXT,
  type TEXT NOT NULL DEFAULT 'markdown' CHECK (type IN ('markdown')),
  name TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_workflow_artifacts_workflow ON task_workflow_artifacts(owner_id, workflow_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_workflow_artifacts_share_token ON task_workflow_artifacts(share_token);
