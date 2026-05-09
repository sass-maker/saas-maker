ALTER TABLE tasks ADD COLUMN blocked_on_user INTEGER NOT NULL DEFAULT 0 CHECK(blocked_on_user IN (0,1));

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL DEFAULT 'user' CHECK(author_type IN ('user','agent')),
  body TEXT NOT NULL,
  resolves_blocker INTEGER NOT NULL DEFAULT 0 CHECK(resolves_blocker IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_comments_owner_task ON task_comments(owner_id, task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_blocked_on_user ON tasks(owner_id, blocked_on_user);
