-- Short Links service
CREATE TABLE IF NOT EXISTS short_links (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  destination TEXT NOT NULL,
  title       TEXT,
  expires_at  TIMESTAMPTZ,
  click_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT short_links_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_short_links_project ON short_links(project_id);
CREATE INDEX IF NOT EXISTS idx_short_links_project_created ON short_links(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_properties ON events USING GIN (properties);
