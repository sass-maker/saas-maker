import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import {
  createCockpitTaskWorkflow,
  ensureCockpitUser,
  getDefaultCockpitOwnerId,
  listCockpitTaskWorkflows,
  type TaskWorkflowInput,
} from '@/lib/cockpit-tasks-store';

export const dynamic = 'force-dynamic';

const WORKFLOW_STATUSES = ['draft', 'active', 'archived'] as const;

function enumValue(value: unknown) {
  return typeof value === 'string' && WORKFLOW_STATUSES.includes(value as typeof WORKFLOW_STATUSES[number])
    ? value as typeof WORKFLOW_STATUSES[number]
    : undefined;
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get('limit'));
  const data = await listCockpitTaskWorkflows({
    task_id: url.searchParams.get('task_id') ?? undefined,
    project_slug: url.searchParams.get('project_slug') ?? undefined,
    status: enumValue(url.searchParams.get('status')),
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null) as Partial<TaskWorkflowInput> | null;
  if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!body.prompt_template || typeof body.prompt_template !== 'string' || !body.prompt_template.trim()) {
    return NextResponse.json({ error: 'prompt_template is required' }, { status: 400 });
  }
  const ownerId = await getDefaultCockpitOwnerId() ?? await ensureCockpitUser(session.user);
  const data = await createCockpitTaskWorkflow(ownerId, {
    task_id: optionalString(body.task_id) ?? null,
    project_slug: optionalString(body.project_slug) ?? null,
    name: body.name.trim(),
    description: optionalString(body.description) ?? null,
    context_markdown: optionalString(body.context_markdown) ?? '',
    prompt_template: body.prompt_template.trim(),
    status: enumValue(body.status) ?? 'draft',
  });
  if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ data }, { status: 201 });
}
