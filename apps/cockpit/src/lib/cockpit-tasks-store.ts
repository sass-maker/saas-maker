import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { TaskCommentRow, TaskRow, SymphonyRunRow } from '@/components/tasks/TaskBoard';

export type CockpitD1Database = {
  prepare: (query: string) => CockpitD1PreparedStatement;
};

type CockpitD1PreparedStatement = {
  bind: (...values: unknown[]) => CockpitD1PreparedStatement;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<{ meta?: { changes?: number } }>;
};

type TaskPatch = Partial<{
  title: string;
  description: string | null;
  status: string;
  priority: string;
  project_slug: string | null;
  task_type: string;
  size: string;
  dependencies: string[];
  branch_name: string | null;
  pr_url: string | null;
  pr_status: string;
  commit_sha: string | null;
  deployment_url: string | null;
  deployment_status: string;
  blocked_on_user: boolean;
}>;

export type TaskCreateInput = TaskPatch & { title: string };
export type TaskCommentInput = {
  body: string;
  author_type?: string;
  resolves_blocker?: boolean;
  marks_done?: boolean;
  sync_to_description?: boolean;
};

export type TaskWorkflowRow = {
  id: string;
  owner_id: string;
  task_id: string | null;
  project_slug: string | null;
  name: string;
  description: string | null;
  context_markdown: string;
  prompt_template: string;
  status: 'draft' | 'active' | 'archived';
  last_run_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskWorkflowArtifactRow = {
  id: string;
  owner_id: string;
  workflow_id: string;
  task_id: string | null;
  project_slug: string | null;
  run_id: string | null;
  type: 'markdown';
  name: string;
  content_markdown: string;
  share_token: string;
  created_at: string;
};

export type TaskWorkflowInput = {
  task_id?: string | null;
  project_slug?: string | null;
  name: string;
  description?: string | null;
  context_markdown?: string | null;
  prompt_template: string;
  status?: 'draft' | 'active' | 'archived';
};

export type CockpitUserInput = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

const VALID_TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;
const VALID_TASK_TYPES = ['feature', 'bug', 'chore', 'docs', 'research', 'cleanup', 'other'] as const;
const VALID_SIZES = ['xs', 's', 'm', 'l', 'xl'] as const;
const VALID_PR_STATUSES = ['none', 'draft', 'open', 'merged', 'closed'] as const;
const VALID_DEPLOYMENT_STATUSES = ['none', 'pending', 'success', 'failed'] as const;

export function getCockpitD1(): CockpitD1Database {
  const { env } = getCloudflareContext();
  const db = (env as { DB?: CockpitD1Database }).DB;
  if (!db) throw new Error('D1 database binding is unavailable.');
  return db;
}

export async function ensureCockpitUser(user: CockpitUserInput, db = getCockpitD1()) {
  const email = typeof user.email === 'string' && user.email.trim()
    ? user.email.trim()
    : `${user.id}@cockpit.local`;
  await db.prepare(`INSERT INTO users (id, email, name, avatar_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`)
    .bind(user.id, email, user.name ?? null, user.image ?? null)
    .run();
  const row = await db.prepare('SELECT id FROM users WHERE id = ?').bind(user.id).first<{ id: string }>()
    ?? await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!row?.id) throw new Error('Could not resolve cockpit user');
  return row.id;
}

export async function getDefaultCockpitOwnerId(db = getCockpitD1()) {
  const taskOwner = await db.prepare('SELECT owner_id FROM tasks GROUP BY owner_id ORDER BY COUNT(*) DESC LIMIT 1')
    .first<{ owner_id?: string }>();
  if (taskOwner?.owner_id) return taskOwner.owner_id;
  const user = await db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').first<{ id?: string }>();
  return user?.id ?? null;
}

function parseDependencies(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function hydrateTask(row: Record<string, unknown> | null): TaskRow | null {
  if (!row) return null;
  return {
    ...(row as unknown as TaskRow),
    dependencies: parseDependencies(row.dependencies),
    blocked_on_user: row.blocked_on_user === true || row.blocked_on_user === 1,
    has_changelog: row.has_changelog === true || row.has_changelog === 1,
  };
}

function hydrateComment(row: Record<string, unknown> | null): TaskCommentRow | null {
  if (!row) return null;
  return {
    ...(row as unknown as TaskCommentRow),
    resolves_blocker: row.resolves_blocker === true || row.resolves_blocker === 1,
    marks_done: row.marks_done === true || row.marks_done === 1,
  };
}

function cleanString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

function normalizeDependencies(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())).map(entry => entry.trim())));
}

function normalizeTaskPatch(input: TaskPatch) {
  const deploymentStatus = enumValue(input.deployment_status, VALID_DEPLOYMENT_STATUSES);
  const blockedOnUser = typeof input.blocked_on_user === 'boolean' ? input.blocked_on_user : undefined;
  return {
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : undefined,
    description: cleanString(input.description),
    status: enumValue(input.status, VALID_TASK_STATUSES),
    priority: enumValue(input.priority, VALID_PRIORITIES),
    project_slug: cleanString(input.project_slug),
    task_type: enumValue(input.task_type, VALID_TASK_TYPES),
    size: enumValue(input.size, VALID_SIZES),
    dependencies: normalizeDependencies(input.dependencies),
    branch_name: cleanString(input.branch_name),
    pr_url: cleanString(input.pr_url),
    pr_status: enumValue(input.pr_status, VALID_PR_STATUSES),
    commit_sha: cleanString(input.commit_sha),
    deployment_url: cleanString(input.deployment_url),
    deployment_status: blockedOnUser === true ? 'none' : deploymentStatus,
    blocked_on_user: deploymentStatus && deploymentStatus !== 'none' ? false : blockedOnUser,
  } satisfies TaskPatch;
}

export async function listCockpitTasks(db = getCockpitD1()) {
  const { results } = await db.prepare(
    `SELECT t.*, CASE WHEN EXISTS(SELECT 1 FROM changelog_entries ce WHERE ce.task_id = t.id LIMIT 1) THEN 1 ELSE 0 END AS has_changelog FROM tasks t ORDER BY t.created_at DESC`
  ).all<Record<string, unknown>>();
  return (results ?? []).map(row => hydrateTask(row)).filter((task): task is TaskRow => Boolean(task));
}

export async function getCockpitTask(id: string, db = getCockpitD1()) {
  return hydrateTask(await db.prepare(
    `SELECT t.*, CASE WHEN EXISTS(SELECT 1 FROM changelog_entries ce WHERE ce.task_id = t.id LIMIT 1) THEN 1 ELSE 0 END AS has_changelog FROM tasks t WHERE t.id = ?`
  ).bind(id).first<Record<string, unknown>>());
}

export async function createCockpitTask(ownerId: string, input: TaskCreateInput, db = getCockpitD1()) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) throw new Error('title is required');
  const id = crypto.randomUUID();
  const patch = normalizeTaskPatch(input);
  await db.prepare(`INSERT INTO tasks (
    id, owner_id, project_slug, title, description, status, priority, task_type, size, dependencies,
    branch_name, pr_url, pr_status, commit_sha, deployment_url, deployment_status, blocked_on_user
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id,
      ownerId,
      patch.project_slug ?? null,
      title,
      patch.description ?? null,
      patch.status ?? 'todo',
      patch.priority ?? 'medium',
      patch.task_type ?? 'feature',
      patch.size ?? 'm',
      JSON.stringify(patch.dependencies ?? []),
      patch.branch_name ?? null,
      patch.pr_url ?? null,
      patch.pr_status ?? 'none',
      patch.commit_sha ?? null,
      patch.deployment_url ?? null,
      patch.deployment_status ?? 'none',
      patch.blocked_on_user ? 1 : 0,
    ).run();
  const task = await getCockpitTask(id, db);
  if (!task) throw new Error('Task was not created');
  return task;
}

export async function updateCockpitTask(id: string, input: TaskPatch, db = getCockpitD1()) {
  const patch = normalizeTaskPatch(input);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === 'dependencies') {
      sets.push('dependencies = ?');
      values.push(JSON.stringify(value));
    } else if (key === 'blocked_on_user') {
      sets.push('blocked_on_user = ?');
      values.push(value ? 1 : 0);
    } else {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (sets.length === 0) return null;
  sets.push("updated_at = datetime('now')");
  values.push(id);
  await db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return getCockpitTask(id, db);
}

export async function deleteCockpitTask(id: string, db = getCockpitD1()) {
  const { meta } = await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return (meta?.changes ?? 0) > 0;
}

export async function listCockpitTaskComments(taskId: string, db = getCockpitD1()) {
  const { results } = await db.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC')
    .bind(taskId)
    .all<Record<string, unknown>>();
  return (results ?? []).map(row => hydrateComment(row)).filter((comment): comment is TaskCommentRow => Boolean(comment));
}

export async function createCockpitTaskComment(taskId: string, input: TaskCommentInput, db = getCockpitD1()) {
  if (typeof input.body !== 'string' || !input.body.trim()) throw new Error('body is required');
  const task = await getCockpitTask(taskId, db);
  if (!task) return null;
  const id = crypto.randomUUID();
  const authorType = input.author_type === 'agent' ? 'agent' : 'user';
  const resolvesBlocker = input.resolves_blocker === true;
  const marksDone = input.marks_done === true;
  await db.prepare(`INSERT INTO task_comments (id, owner_id, task_id, author_type, body, resolves_blocker, marks_done)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, task.owner_id, taskId, authorType, input.body.trim(), resolvesBlocker ? 1 : 0, marksDone ? 1 : 0)
    .run();
  if (resolvesBlocker) {
    await db.prepare("UPDATE tasks SET blocked_on_user = 0, updated_at = datetime('now') WHERE id = ?").bind(taskId).run();
  }
  if (marksDone) {
    await db.prepare("UPDATE tasks SET status = 'done', blocked_on_user = 0, updated_at = datetime('now') WHERE id = ?").bind(taskId).run();
  }
  if (input.sync_to_description === true) {
    const descriptionNote = `Decision / Handoff\n${input.body.trim()}`;
    await db.prepare(`UPDATE tasks
      SET description = CASE
        WHEN description IS NULL OR trim(description) = '' THEN ?
        ELSE description || char(10) || char(10) || ?
      END,
      updated_at = datetime('now')
      WHERE id = ?`)
      .bind(descriptionNote, descriptionNote, taskId)
      .run();
  }
  const comment = hydrateComment(await db.prepare('SELECT * FROM task_comments WHERE id = ?').bind(id).first<Record<string, unknown>>());
  if (!comment) throw new Error('Comment was not created');
  return comment;
}

export async function listCockpitRuns(limit = 200, taskId?: string, db = getCockpitD1()) {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  if (taskId) {
    const { results } = await db.prepare('SELECT * FROM symphony_runs WHERE task_id = ? ORDER BY started_at DESC, created_at DESC LIMIT ?')
      .bind(taskId, safeLimit)
      .all<SymphonyRunRow>();
    return results ?? [];
  }
  const { results } = await db.prepare('SELECT * FROM symphony_runs ORDER BY started_at DESC, created_at DESC LIMIT ?')
    .bind(safeLimit)
    .all<SymphonyRunRow>();
  return results ?? [];
}

export async function listCockpitProjectSlugs(db = getCockpitD1()) {
  const { results } = await db.prepare('SELECT slug FROM fleet_metadata ORDER BY slug ASC').all<{ slug?: string }>();
  return (results ?? []).map(row => row.slug).filter((slug): slug is string => Boolean(slug));
}

export async function getCockpitSymphonyMemory(ownerId: string, db = getCockpitD1()) {
  const own = await db.prepare('SELECT owner_id, content, updated_at FROM symphony_memory WHERE owner_id = ?').bind(ownerId).first<{ content?: string }>();
  if (own?.content) return own.content;
  const latest = await db.prepare('SELECT owner_id, content, updated_at FROM symphony_memory ORDER BY updated_at DESC LIMIT 1').first<{ content?: string }>();
  return latest?.content ?? '';
}

export async function updateCockpitSymphonyMemory(ownerId: string, content: string, db = getCockpitD1()) {
  await db.prepare(`INSERT INTO symphony_memory (owner_id, content, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(owner_id) DO UPDATE SET content = EXCLUDED.content, updated_at = datetime('now')`)
    .bind(ownerId, content)
    .run();
  return db.prepare('SELECT owner_id, content, updated_at FROM symphony_memory WHERE owner_id = ?').bind(ownerId).first<{ owner_id: string; content: string; updated_at: string }>();
}

export async function createCockpitTaskWorkflow(ownerId: string, input: TaskWorkflowInput, db = getCockpitD1()) {
  let projectSlug = input.project_slug ?? null;
  if (input.task_id) {
    const task = await getCockpitTask(input.task_id, db);
    if (!task) return null;
    projectSlug = projectSlug ?? task.project_slug;
  }
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO task_workflows (
    id, owner_id, task_id, project_slug, name, description, context_markdown, prompt_template, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id,
      ownerId,
      input.task_id ?? null,
      projectSlug,
      input.name,
      input.description ?? null,
      input.context_markdown ?? '',
      input.prompt_template,
      input.status ?? 'draft',
    )
    .run();
  return db.prepare('SELECT * FROM task_workflows WHERE id = ?').bind(id).first<TaskWorkflowRow>();
}

export async function listCockpitTaskWorkflows(input: { task_id?: string; project_slug?: string; status?: TaskWorkflowRow['status']; limit?: number } = {}, db = getCockpitD1()) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (input.task_id) {
    conditions.push('task_id = ?');
    values.push(input.task_id);
  }
  if (input.project_slug) {
    conditions.push('project_slug = ?');
    values.push(input.project_slug);
  }
  if (input.status) {
    conditions.push('status = ?');
    values.push(input.status);
  }
  values.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { results } = await db.prepare(`SELECT * FROM task_workflows ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ?`)
    .bind(...values)
    .all<TaskWorkflowRow>();
  return results ?? [];
}

export async function getCockpitTaskWorkflow(id: string, db = getCockpitD1()) {
  return db.prepare('SELECT * FROM task_workflows WHERE id = ?').bind(id).first<TaskWorkflowRow>();
}

export async function updateCockpitTaskWorkflow(id: string, input: Partial<TaskWorkflowInput & { last_run_id: string | null }>, db = getCockpitD1()) {
  const patch = { ...input };
  if (patch.task_id) {
    const task = await getCockpitTask(patch.task_id, db);
    if (!task) return null;
    if (patch.project_slug === undefined) patch.project_slug = task.project_slug;
  }
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const key of ['task_id', 'project_slug', 'name', 'description', 'context_markdown', 'prompt_template', 'status', 'last_run_id'] as const) {
    if (patch[key] === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(patch[key]);
  }
  if (sets.length === 0) return getCockpitTaskWorkflow(id, db);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  await db.prepare(`UPDATE task_workflows SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  return getCockpitTaskWorkflow(id, db);
}

export async function createCockpitTaskWorkflowArtifact(workflowId: string, input: { name: string; content_markdown: string; run_id?: string | null }, db = getCockpitD1()) {
  const workflow = await getCockpitTaskWorkflow(workflowId, db);
  if (!workflow) return null;
  const id = crypto.randomUUID();
  const shareToken = crypto.randomUUID();
  await db.prepare(`INSERT INTO task_workflow_artifacts (
    id, owner_id, workflow_id, task_id, project_slug, run_id, type, name, content_markdown, share_token
  ) VALUES (?, ?, ?, ?, ?, ?, 'markdown', ?, ?, ?)`)
    .bind(
      id,
      workflow.owner_id,
      workflowId,
      workflow.task_id,
      workflow.project_slug,
      input.run_id ?? workflow.last_run_id ?? null,
      input.name,
      input.content_markdown,
      shareToken,
    )
    .run();
  return db.prepare('SELECT * FROM task_workflow_artifacts WHERE id = ?').bind(id).first<TaskWorkflowArtifactRow>();
}

export async function listCockpitTaskWorkflowArtifacts(workflowId: string, db = getCockpitD1()) {
  const { results } = await db.prepare('SELECT * FROM task_workflow_artifacts WHERE workflow_id = ? ORDER BY created_at DESC')
    .bind(workflowId)
    .all<TaskWorkflowArtifactRow>();
  return results ?? [];
}

export async function getCockpitTaskWorkflowArtifactByShareToken(shareToken: string, db = getCockpitD1()) {
  return db.prepare('SELECT * FROM task_workflow_artifacts WHERE share_token = ?').bind(shareToken).first<TaskWorkflowArtifactRow>();
}
