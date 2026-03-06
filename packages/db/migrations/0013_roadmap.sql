-- Roadmap items
CREATE TABLE IF NOT EXISTS roadmap_items (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES feedback(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  "column" TEXT NOT NULL DEFAULT 'backlog',
  position INT NOT NULL DEFAULT 0,
  public BOOLEAN NOT NULL DEFAULT true,
  upvote_count INT NOT NULL DEFAULT 0,
  downvote_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roadmap_items_project ON roadmap_items(project_id);
CREATE INDEX idx_roadmap_items_project_column ON roadmap_items(project_id, "column", position);
CREATE INDEX idx_roadmap_items_feedback ON roadmap_items(feedback_id);

-- Roadmap votes
CREATE TABLE IF NOT EXISTS roadmap_votes (
  id UUID PRIMARY KEY,
  roadmap_item_id UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roadmap_item_id, user_identifier)
);

CREATE INDEX idx_roadmap_votes_item ON roadmap_votes(roadmap_item_id);
