-- Optional retry identity. Older clients and rollback code ignore these columns.
ALTER TABLE feedback ADD COLUMN submission_fingerprint TEXT;
ALTER TABLE feedback ADD COLUMN submission_id TEXT;
-- NULL identities preserve independent posts from legacy clients.
CREATE UNIQUE INDEX feedback_project_submission ON feedback(project_id, submission_id);
