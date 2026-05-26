import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import { deleteCockpitTask, getCockpitTask, updateCockpitTask } from '@/lib/cockpit-tasks-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const data = await getCockpitTask(id);
  if (!data) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data = await updateCockpitTask(id, body);
  if (!data) return NextResponse.json({ error: 'Task not found or unchanged' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const ok = await deleteCockpitTask(id);
  if (!ok) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
