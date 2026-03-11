-- Directory listings for "Made with SaasMaker" directory

CREATE TABLE IF NOT EXISTS directory_listings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  screenshot_url TEXT,
  twitter_url TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  badge_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_directory_status ON directory_listings(status);
CREATE INDEX IF NOT EXISTS idx_directory_project ON directory_listings(project_id);
CREATE INDEX IF NOT EXISTS idx_directory_created ON directory_listings(created_at DESC);
