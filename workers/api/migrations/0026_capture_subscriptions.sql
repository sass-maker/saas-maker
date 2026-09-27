-- Product-scoped newsletter and waitlist capture. The retired waitlist_entries
-- table remains untouched until its historical contents are reviewed.
CREATE TABLE capture_subscriptions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('newsletter', 'waitlist')),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  source TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'unsubscribed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, kind, email_normalized)
);

CREATE INDEX idx_capture_subscriptions_project_state
  ON capture_subscriptions(project_id, kind, state, created_at);
