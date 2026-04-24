CREATE TABLE IF NOT EXISTS fleet_metadata (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT '-',
  framework_version TEXT,
  db TEXT NOT NULL DEFAULT '-',
  auth TEXT NOT NULL DEFAULT '-',
  deploy TEXT NOT NULL DEFAULT '-',
  test_frameworks TEXT NOT NULL DEFAULT '-',
  saasmaker_count INTEGER NOT NULL DEFAULT 0,
  foundry_linked INTEGER NOT NULL DEFAULT 0,
  last_scanned TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, slug)
);
CREATE INDEX idx_fleet_metadata_owner ON fleet_metadata(owner_id);
