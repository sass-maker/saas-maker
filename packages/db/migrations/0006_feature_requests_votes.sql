-- Feature request statuses + directional voting

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS downvote_count INT NOT NULL DEFAULT 0;

ALTER TABLE upvotes
  ADD COLUMN IF NOT EXISTS vote SMALLINT;

UPDATE upvotes
SET vote = 1
WHERE vote IS NULL;

ALTER TABLE upvotes
  ALTER COLUMN vote SET DEFAULT 1;

ALTER TABLE upvotes
  ALTER COLUMN vote SET NOT NULL;

ALTER TABLE upvotes
  DROP CONSTRAINT IF EXISTS upvotes_vote_check;

ALTER TABLE upvotes
  ADD CONSTRAINT upvotes_vote_check CHECK (vote IN (1, -1));

ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_status_check;

ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS check_status;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_status_check CHECK (
    status IN (
      'new',
      'in_progress',
      'done',
      'dismissed',
      'planned',
      'shipped',
      'cancelled'
    )
  );

UPDATE feedback
SET status = CASE
  WHEN status = 'new' THEN 'planned'
  WHEN status = 'done' THEN 'shipped'
  WHEN status = 'dismissed' THEN 'cancelled'
  ELSE status
END
WHERE type = 'feature';

UPDATE feedback
SET upvote_count = 0,
    downvote_count = 0;

UPDATE feedback AS f
SET upvote_count = v.upvotes,
    downvote_count = v.downvotes
FROM (
  SELECT
    feedback_id,
    SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END)::INT AS upvotes,
    SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END)::INT AS downvotes
  FROM upvotes
  GROUP BY feedback_id
) AS v
WHERE f.id = v.feedback_id;

CREATE INDEX IF NOT EXISTS idx_feedback_project_type_status ON feedback(project_id, type, status);
