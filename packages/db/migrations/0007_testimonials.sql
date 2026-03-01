-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_avatar_url TEXT,
  author_title TEXT,
  content TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  image_url TEXT,
  tweet_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_project ON testimonials(project_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_project_status ON testimonials(project_id, status);
