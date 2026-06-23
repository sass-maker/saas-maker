import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb, type TaskRow, type TaskWorkflowRow } from '../db';
import { capture } from '../lib/telemetry';

const taskWorkflows = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const WORKFLOW_STATUSES = ['draft', 'active', 'archived'] as const;

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    return { error: `${field} is required` };
  }
  return { value: value.trim() };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : undefined;
}

function renderWorkflowPrompt(workflow: TaskWorkflowRow, task?: TaskRow | null) {
  const sections = [
    `# ${workflow.name}`,
    workflow.description ? `## Workflow\n${workflow.description}` : null,
    task
      ? [
          '## Task',
          `- id: ${task.id}`,
          `- title: ${task.title}`,
          `- project: ${task.project_slug ?? workflow.project_slug ?? 'unassigned'}`,
          `- status: ${task.status}`,
          `- priority: ${task.priority}`,
          task.description ? `\n${task.description}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      : null,
    workflow.context_markdown.trim() ? `## Context\n${workflow.context_markdown.trim()}` : null,
    `## Prompt\n${workflow.prompt_template.trim()}`,
  ].filter(Boolean);
  return sections.join('\n\n').trim();
}

async function recordAudit(
  db: ReturnType<typeof getDb>,
  ownerId: string,
  input: {
    task_id?: string | null;
    action: string;
    project_slug?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await db.createSymphonyAuditEvent(ownerId, {
      ...input,
      actor_source: 'api',
    });
  } catch (error) {
    console.warn('Failed to record task workflow audit event', error);
  }
}

taskWorkflows.get('/artifacts/:shareToken', async (c) => {
  const shareToken = c.req.param('shareToken');
  const db = getDb(c.env.DB);
  const artifact = await db.getTaskWorkflowArtifactByShareToken(shareToken);
  if (!artifact) return c.json({ error: 'Artifact not found' }, 404);
  return c.json({ data: artifact });
});

taskWorkflows.get('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  const limitRaw = Number(c.req.query('limit'));
  const data = await db.listTaskWorkflows(userId, {
    task_id: c.req.query('task_id'),
    project_slug: c.req.query('project_slug'),
    status: enumValue(c.req.query('status'), WORKFLOW_STATUSES),
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  });
  return c.json({ data });
});

taskWorkflows.post('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = requiredString(body?.name, 'name');
  if ('error' in name) return c.json({ error: name.error }, 400);
  const promptTemplate = requiredString(body?.prompt_template, 'prompt_template');
  if ('error' in promptTemplate) return c.json({ error: promptTemplate.error }, 400);
  const status = enumValue(body?.status, WORKFLOW_STATUSES) ?? 'draft';
  const db = getDb(c.env.DB);
  const workflow = await db.createTaskWorkflow(userId, {
    task_id: optionalString(body?.task_id) ?? null,
    project_slug: optionalString(body?.project_slug) ?? null,
    name: name.value,
    description: optionalString(body?.description) ?? null,
    context_markdown: optionalString(body?.context_markdown) ?? '',
    prompt_template: promptTemplate.value,
    status,
  });
  if (!workflow) return c.json({ error: 'Task not found' }, 404);
  await recordAudit(db, userId, {
    task_id: workflow.task_id,
    action: 'task_workflow_created',
    project_slug: workflow.project_slug,
    metadata: { workflow_id: workflow.id, status: workflow.status },
  });
  capture({
    distinctId: userId,
    event: 'task_workflow_created',
    properties: {
      workflow_id: workflow.id,
      task_id: workflow.task_id ?? undefined,
      project_id: workflow.project_slug ?? undefined,
    },
  });
  return c.json({ data: workflow }, 201);
});

taskWorkflows.get('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const db = getDb(c.env.DB);
  const workflow = await db.getTaskWorkflow(c.req.param('id'), userId);
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);
  const artifacts = await db.listTaskWorkflowArtifacts(userId, workflow.id);
  return c.json({ data: workflow, artifacts });
});

taskWorkflows.patch('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const key of [
    'task_id',
    'project_slug',
    'name',
    'description',
    'context_markdown',
    'prompt_template',
    'last_run_id',
  ] as const) {
    if (key in body) updates[key] = optionalString(body[key]);
  }
  // context_markdown is NOT NULL in the schema; clearing it means ''.
  if (updates.context_markdown === null) updates.context_markdown = '';
  if ('status' in body) {
    const status = enumValue(body.status, WORKFLOW_STATUSES);
    if (!status) return c.json({ error: 'status is invalid' }, 400);
    updates.status = status;
  }
  if ('name' in updates && !updates.name) return c.json({ error: 'name is required' }, 400);
  if ('prompt_template' in updates && !updates.prompt_template)
    return c.json({ error: 'prompt_template is required' }, 400);
  const db = getDb(c.env.DB);
  const workflow = await db.updateTaskWorkflow(c.req.param('id'), userId, updates);
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);
  await recordAudit(db, userId, {
    task_id: workflow.task_id,
    action: 'task_workflow_updated',
    project_slug: workflow.project_slug,
    metadata: { workflow_id: workflow.id, changed_fields: Object.keys(body) },
  });
  return c.json({ data: workflow });
});

taskWorkflows.post('/:id/runs', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = getDb(c.env.DB);
  const workflow = await db.getTaskWorkflow(c.req.param('id'), userId);
  if (!workflow) return c.json({ error: 'Workflow not found' }, 404);
  const task = workflow.task_id ? await db.getTask(workflow.task_id, userId) : null;
  const prompt = renderWorkflowPrompt(workflow, task);
  const runId = optionalString(body.run_id);
  const data = runId
    ? await db.updateTaskWorkflow(workflow.id, userId, { last_run_id: runId })
    : workflow;
  await recordAudit(db, userId, {
    task_id: workflow.task_id,
    action: runId ? 'task_workflow_run_recorded' : 'task_workflow_run_prepared',
    project_slug: workflow.project_slug,
    metadata: { workflow_id: workflow.id, run_id: runId ?? null },
  });
  return c.json(
    {
      data,
      prompt,
      droid_run_payload: {
        mode: 'native',
        task_id: workflow.task_id,
        project_slug: workflow.project_slug,
        prompt,
      },
    },
    runId ? 200 : 202
  );
});

taskWorkflows.post('/:id/artifacts', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = requiredString(body?.name, 'name');
  if ('error' in name) return c.json({ error: name.error }, 400);
  const content = requiredString(body?.content_markdown, 'content_markdown');
  if ('error' in content) return c.json({ error: content.error }, 400);
  const db = getDb(c.env.DB);
  const artifact = await db.createTaskWorkflowArtifact(userId, c.req.param('id'), {
    name: name.value,
    content_markdown: content.value,
    run_id: optionalString(body?.run_id) ?? null,
  });
  if (!artifact) return c.json({ error: 'Workflow not found' }, 404);
  await recordAudit(db, userId, {
    task_id: artifact.task_id,
    action: 'task_workflow_artifact_created',
    project_slug: artifact.project_slug,
    metadata: {
      workflow_id: artifact.workflow_id,
      artifact_id: artifact.id,
      run_id: artifact.run_id,
    },
  });
  return c.json({ data: artifact }, 201);
});

export { taskWorkflows };
