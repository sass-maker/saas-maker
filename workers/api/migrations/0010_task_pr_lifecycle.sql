ALTER TABLE tasks ADD COLUMN branch_name TEXT;
ALTER TABLE tasks ADD COLUMN pr_url TEXT;
ALTER TABLE tasks ADD COLUMN pr_status TEXT NOT NULL DEFAULT 'none' CHECK(pr_status IN ('none','draft','open','merged','closed'));
ALTER TABLE tasks ADD COLUMN commit_sha TEXT;
ALTER TABLE tasks ADD COLUMN deployment_url TEXT;
ALTER TABLE tasks ADD COLUMN deployment_status TEXT NOT NULL DEFAULT 'none' CHECK(deployment_status IN ('none','pending','success','failed'));

CREATE INDEX IF NOT EXISTS idx_tasks_owner_pr_status ON tasks(owner_id, pr_status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_deployment_status ON tasks(owner_id, deployment_status);
