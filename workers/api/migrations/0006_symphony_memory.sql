CREATE TABLE IF NOT EXISTS symphony_memory (
  owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
