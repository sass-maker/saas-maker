import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import {
  getCockpitTaskWorkflow,
  listCockpitTaskWorkflowArtifacts,
  updateCockpitTaskWorkflow,
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await getCockpitTaskWorkflow(id);
  if (!data) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  const artifacts = await listCockpitTaskWorkflowArtifacts(id);
  return NextResponse.json({ data, artifacts });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of ['task_id', 'project_slug', 'name', 'description', 'context_markdown', 'prompt_template', 'last_run_id'] as const) {
    if (key in body) patch[key] = optionalString(body[key]);
  }
  // context_markdown is NOT NULL in the schema; clearing it means ''.
  if (patch.context_markdown === null) patch.context_markdown = '';
  if ('status' in body) {
    const status = enumValue(body.status);
    if (!status) return NextResponse.json({ error: 'status is invalid' }, { status: 400 });
    patch.status = status;
  }
  if ('name' in patch && !patch.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if ('prompt_template' in patch && !patch.prompt_template) return NextResponse.json({ error: 'prompt_template is required' }, { status: 400 });
  const data = await updateCockpitTaskWorkflow(id, patch);
  if (!data) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  return NextResponse.json({ data });
}
