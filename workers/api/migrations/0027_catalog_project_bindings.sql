-- Explicit owner-managed mapping from SaaS Maker projects to Fleet catalog IDs.
-- Bindings are populated separately; request payloads never write this table.
CREATE TABLE catalog_project_bindings (
  saas_maker_project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  catalog_project_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
