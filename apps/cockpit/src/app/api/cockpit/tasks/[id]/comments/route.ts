import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import { createCockpitTaskComment, getCockpitTask, listCockpitTaskComments } from '@/lib/cockpit-tasks-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await listCockpitTaskComments(id);
  return NextResponse.json({ data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.body !== 'string' || !body.body.trim()) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }
  const data = await createCockpitTaskComment(id, body);
  if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  const task = body.resolves_blocker === true || body.marks_done === true || body.sync_to_description === true
    ? await getCockpitTask(id)
    : null;
  return NextResponse.json({ data, task }, { status: 201 });
}
