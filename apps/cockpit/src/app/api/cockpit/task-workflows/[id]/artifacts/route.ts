import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import { createCockpitTaskWorkflowArtifact } from '@/lib/cockpit-tasks-store';

export const dynamic = 'force-dynamic';

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const name = cleanString(body?.name);
  const content = cleanString(body?.content_markdown);
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!content) return NextResponse.json({ error: 'content_markdown is required' }, { status: 400 });
  const data = await createCockpitTaskWorkflowArtifact(id, {
    name,
    content_markdown: content,
    run_id: cleanString(body?.run_id),
  });
  if (!data) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  return NextResponse.json({ data }, { status: 201 });
}
