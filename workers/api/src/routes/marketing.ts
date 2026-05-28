import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';

const marketing = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const STATUSES = ['generated', 'accepted', 'rejected', 'sent'] as const;
const CHANNELS = ['x', 'linkedin', 'reddit', 'email', 'blog', 'producthunt', 'other'] as const;
const SOURCES = ['manual', 'task', 'changelog'] as const;

function cleanString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : undefined;
}

function normalizeInput(input: Record<string, unknown>) {
  return {
    project_slug: cleanString(input.project_slug),
    channel: enumValue(input.channel, CHANNELS),
    status: enumValue(input.status, STATUSES),
    title: cleanString(input.title),
    hook: cleanString(input.hook),
    body: cleanString(input.body),
    cta: cleanString(input.cta),
    asset_url: cleanString(input.asset_url),
    source_type: enumValue(input.source_type, SOURCES),
    source_id: cleanString(input.source_id),
    task_id: cleanString(input.task_id),
    changelog_entry_id: cleanString(input.changelog_entry_id),
    scheduled_for: cleanString(input.scheduled_for),
    exported_at: cleanString(input.exported_at),
    posted_at: cleanString(input.posted_at),
    result_url: cleanString(input.result_url),
    notes: cleanString(input.notes),
  };
}

marketing.use('*', requireSession);

marketing.get('/posts', async (c) => {
  const userId = c.get('userId')!;
  const status = enumValue(c.req.query('status'), STATUSES);
  const channel = enumValue(c.req.query('channel'), CHANNELS);
  const projectSlug = cleanString(c.req.query('project_slug'));
  const conditions = ['owner_id = ?'];
  const values: unknown[] = [userId];
  if (status) {
    conditions.push('status = ?');
    values.push(status);
  }
  if (channel) {
    conditions.push('channel = ?');
    values.push(channel);
  }
  if (projectSlug) {
    conditions.push('project_slug = ?');
    values.push(projectSlug);
  }
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') ?? '200', 10) || 200, 1), 500);
  values.push(limit);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM marketing_posts WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE status WHEN 'generated' THEN 0 WHEN 'accepted' THEN 1 WHEN 'sent' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END,
       created_at DESC
     LIMIT ?`
  ).bind(...values).all();
  return c.json({ data: results ?? [] });
});

marketing.post('/posts', async (c) => {
  const userId = c.get('userId')!;
  const body = normalizeInput(await c.req.json().catch(() => ({})) as Record<string, unknown>);
  if (!body.title) return c.json({ error: 'title is required' }, 400);
  if (!body.body) return c.json({ error: 'body is required' }, 400);
  const id = crypto.randomUUID();
  const sourceType = body.source_type ?? (body.task_id ? 'task' : 'manual');
  await c.env.DB.prepare(`INSERT INTO marketing_posts (
    id, owner_id, project_slug, channel, status, title, hook, body, cta, asset_url,
    source_type, source_id, task_id, changelog_entry_id, scheduled_for, exported_at,
    posted_at, result_url, notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id,
      userId,
      body.project_slug ?? null,
      body.channel ?? 'x',
      body.status ?? 'generated',
      body.title,
      body.hook ?? null,
      body.body,
      body.cta ?? null,
      body.asset_url ?? null,
      sourceType,
      body.source_id ?? body.task_id ?? null,
      body.task_id ?? null,
      body.changelog_entry_id ?? null,
      body.scheduled_for ?? null,
      body.exported_at ?? null,
      body.posted_at ?? null,
      body.result_url ?? null,
      body.notes ?? null,
    ).run();
  const data = await c.env.DB.prepare('SELECT * FROM marketing_posts WHERE id = ? AND owner_id = ?')
    .bind(id, userId)
    .first();
  return c.json({ data }, 201);
});

marketing.patch('/posts/:id', async (c) => {
  const userId = c.get('userId')!;
  const id = c.req.param('id');
  const patch = normalizeInput(await c.req.json().catch(() => ({})) as Record<string, unknown>);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return c.json({ error: 'no valid fields to update' }, 400);
  sets.push("updated_at = datetime('now')");
  values.push(id, userId);
  await c.env.DB.prepare(`UPDATE marketing_posts SET ${sets.join(', ')} WHERE id = ? AND owner_id = ?`)
    .bind(...values)
    .run();
  const data = await c.env.DB.prepare('SELECT * FROM marketing_posts WHERE id = ? AND owner_id = ?')
    .bind(id, userId)
    .first();
  if (!data) return c.json({ error: 'Marketing post not found' }, 404);
  return c.json({ data });
});

export { marketing };
