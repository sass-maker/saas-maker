-- Add source column to projects for integration isolation (e.g., LinkChat)
ALTER TABLE projects ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'dashboard';
