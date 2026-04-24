-- Feedback module initial schema (CockroachDB/Postgres compatible)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'feedback')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN (
      'new',
      'in_progress',
      'done',
      'dismissed',
      'planned',
      'shipped',
      'cancelled'
    )
  ),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  submitter_email TEXT NOT NULL,
  submitter_name TEXT,
  upvote_count INT NOT NULL DEFAULT 0,
  downvote_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upvotes (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  vote SMALLINT NOT NULL DEFAULT 1 CHECK (vote IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_project_status ON feedback(project_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_project_upvotes ON feedback(project_id, upvote_count DESC);
CREATE INDEX IF NOT EXISTS idx_upvotes_feedback ON upvotes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
