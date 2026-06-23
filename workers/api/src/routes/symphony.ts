import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { capture } from '../lib/telemetry';

const symphony = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_MEMORY_LENGTH = 50000;
const MAX_AUDIT_LIMIT = 200;
const MAX_RUN_LIMIT = 200;

function safeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isMissingSymphonyMemoryTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('symphony_memory') && message.toLowerCase().includes('no such table');
}

symphony.get('/memory', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  let row;
  try {
    row = await db.getSymphonyMemory(userId);
  } catch (error) {
    if (isMissingSymphonyMemoryTable(error)) {
      return c.json({ error: 'Symphony memory storage is not migrated yet.' }, 503);
    }
    throw error;
  }
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
  const body = (await c.req.json()) as { content?: unknown };
  if (typeof body.content !== 'string') {
    return c.json({ error: 'content is required' }, 400);
  }
  if (body.content.length > MAX_MEMORY_LENGTH) {
    return c.json({ error: `content must be ${MAX_MEMORY_LENGTH} characters or fewer` }, 400);
  }

  const db = getDb(c.env.DB);
  let data;
  try {
    data = await db.upsertSymphonyMemory(userId, body.content);
  } catch (error) {
    if (isMissingSymphonyMemoryTable(error)) {
      return c.json({ error: 'Symphony memory storage is not migrated yet.' }, 503);
    }
    throw error;
  }
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
  const body = (await c.req.json()) as {
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
  capture({
    distinctId: userId,
    event: 'symphony_audit_event_recorded',
    properties: {
      action: data.action,
      task_id: data.task_id ?? undefined,
      actor_source: data.actor_source,
    },
  });
  return c.json({ data }, 201);
});

symphony.get('/runs', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const taskId = c.req.query('task_id') || undefined;
  const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), MAX_RUN_LIMIT);
  const db = getDb(c.env.DB);
  const data = await db.listSymphonyRuns(userId, { task_id: taskId, limit });
  return c.json({ data });
});

symphony.post('/runs', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json()) as {
    task_id?: unknown;
    project_slug?: unknown;
    agent_profile?: unknown;
    model_profile?: unknown;
    command_template?: unknown;
    pid?: unknown;
    status?: unknown;
    workspace_path?: unknown;
    prompt_path?: unknown;
    terminal_hint?: unknown;
    log_hint?: unknown;
    cost_note?: unknown;
    token_note?: unknown;
    metadata?: unknown;
    started_at?: unknown;
  };
  if (typeof body.command_template !== 'string' || !body.command_template.trim()) {
    return c.json({ error: 'command_template is required' }, 400);
  }

  const db = getDb(c.env.DB);
  const data = await db.createSymphonyRun(userId, {
    task_id: optionalString(body.task_id),
    project_slug: optionalString(body.project_slug),
    agent_profile: optionalString(body.agent_profile),
    model_profile: optionalString(body.model_profile),
    command_template: body.command_template.trim(),
    pid: optionalNumber(body.pid),
    status: optionalString(body.status) ?? 'started',
    workspace_path: optionalString(body.workspace_path),
    prompt_path: optionalString(body.prompt_path),
    terminal_hint: optionalString(body.terminal_hint),
    log_hint: optionalString(body.log_hint),
    cost_note: optionalString(body.cost_note),
    token_note: optionalString(body.token_note),
    metadata: safeMetadata(body.metadata),
    started_at: optionalString(body.started_at),
  });
  capture({
    distinctId: userId,
    event: 'symphony_run_started',
    properties: {
      task_id: data.task_id ?? undefined,
      agent_profile: data.agent_profile ?? undefined,
      command_template: data.command_template,
      project_id: data.project_slug ?? undefined,
    },
  });
  return c.json({ data }, 201);
});

export { symphony };
