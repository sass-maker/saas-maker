ALTER TABLE task_comments ADD COLUMN marks_done INTEGER NOT NULL DEFAULT 0 CHECK(marks_done IN (0,1));
