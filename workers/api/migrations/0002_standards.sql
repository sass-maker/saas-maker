-- Global standards config per project type (next/vite/node)
-- owner_id ties to the users table
CREATE TABLE IF NOT EXISTS standards (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('next', 'vite', 'node')),
  eslint_rules TEXT NOT NULL DEFAULT '{}',   -- JSON: { "rule-name": "error"|"warn"|"off" }
  tsconfig_options TEXT NOT NULL DEFAULT '{}', -- JSON: { "strict": true, ... }
  prettier_options TEXT NOT NULL DEFAULT '{}', -- JSON: { "semi": true, ... }
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, type)
);
CREATE INDEX idx_standards_owner ON standards(owner_id);
