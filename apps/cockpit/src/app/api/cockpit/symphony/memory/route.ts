import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import { ensureCockpitUser, getCockpitSymphonyMemory, getDefaultCockpitOwnerId, updateCockpitSymphonyMemory } from '@/lib/cockpit-tasks-store';

export const dynamic = 'force-dynamic';

const MAX_MEMORY_LENGTH = 50000;

export async function GET(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ownerId = await getDefaultCockpitOwnerId() ?? await ensureCockpitUser(session.user);
  const content = await getCockpitSymphonyMemory(ownerId);
  return NextResponse.json({ data: { owner_id: ownerId, content } });
}

export async function PUT(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null) as { content?: unknown } | null;
  if (typeof body?.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }
  if (body.content.length > MAX_MEMORY_LENGTH) {
    return NextResponse.json({ error: `content must be ${MAX_MEMORY_LENGTH} characters or fewer` }, { status: 400 });
  }
  const ownerId = await getDefaultCockpitOwnerId() ?? await ensureCockpitUser(session.user);
  const data = await updateCockpitSymphonyMemory(ownerId, body.content);
  return NextResponse.json({ data });
}
