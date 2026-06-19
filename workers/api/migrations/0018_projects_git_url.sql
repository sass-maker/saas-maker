-- Add git_url to projects so fleet clients (e.g. CodeVetter) can
-- auto-detect the project a local repo belongs to without a manual mapping.
-- Nullable; not unique (a monorepo can legitimately back multiple project rows).
ALTER TABLE projects ADD COLUMN git_url TEXT;
