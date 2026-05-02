import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { capture } from '@saas-maker/ops';

const symphony = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_MEMORY_LENGTH = 50000;
const MAX_AUDIT_LIMIT = 200;

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

symphony.get('/memory', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  const row = await db.getSymphonyMemory(userId);
  return c.json({
    data: row ?? {
      owner_id: userId,
      content: '',
      updated_at: null,
    },
  });
});

symphony.put('/memory', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json() as { content?: unknown };
  if (typeof body.content !== 'string') {
    return c.json({ error: 'content is required' }, 400);
  }
  if (body.content.length > MAX_MEMORY_LENGTH) {
    return c.json({ error: `content must be ${MAX_MEMORY_LENGTH} characters or fewer` }, 400);
  }

  const db = getDb(c.env.DB);
  const data = await db.upsertSymphonyMemory(userId, body.content);
  capture({ distinctId: userId, event: 'symphony_memory_updated' });
  return c.json({ data });
});

symphony.get('/audit', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const taskId = c.req.query('task_id') || undefined;
  const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), MAX_AUDIT_LIMIT);
  const db = getDb(c.env.DB);
  const data = await db.listSymphonyAuditEvents(userId, { task_id: taskId, limit });
  return c.json({ data });
});

symphony.post('/audit', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = await c.req.json() as {
    task_id?: unknown;
    action?: unknown;
    actor_source?: unknown;
    agent_profile?: unknown;
    project_slug?: unknown;
    metadata?: unknown;
  };
  if (typeof body.action !== 'string' || !body.action.trim()) {
    return c.json({ error: 'action is required' }, 400);
  }

  const db = getDb(c.env.DB);
  const data = await db.createSymphonyAuditEvent(userId, {
    task_id: typeof body.task_id === 'string' ? body.task_id : null,
    action: body.action.trim(),
    actor_source: typeof body.actor_source === 'string' ? body.actor_source : 'local-cli',
    agent_profile: typeof body.agent_profile === 'string' ? body.agent_profile : null,
    project_slug: typeof body.project_slug === 'string' ? body.project_slug : null,
    metadata: safeMetadata(body.metadata),
  });
  capture({ distinctId: userId, event: 'symphony_audit_event_recorded', properties: { action: data.action, task_id: data.task_id ?? undefined, actor_source: data.actor_source } });
  return c.json({ data }, 201);
});

export { symphony };
