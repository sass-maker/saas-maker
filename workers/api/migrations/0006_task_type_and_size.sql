ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'feature' CHECK(task_type IN ('feature','bug','chore','docs','research','cleanup','other'));
ALTER TABLE tasks ADD COLUMN size TEXT NOT NULL DEFAULT 'm' CHECK(size IN ('xs','s','m','l','xl'));
