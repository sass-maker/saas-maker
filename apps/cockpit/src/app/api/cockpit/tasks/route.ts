import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import {
  createCockpitTask,
  ensureCockpitUser,
  getDefaultCockpitOwnerId,
  listCockpitTasks,
  type TaskCreateInput,
} from '@/lib/cockpit-tasks-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await listCockpitTasks();
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as TaskCreateInput | null;
  if (!body?.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  const ownerId = (await getDefaultCockpitOwnerId()) ?? (await ensureCockpitUser(session.user));
  const data = await createCockpitTask(ownerId, body);
  return NextResponse.json({ data }, { status: 201 });
}
