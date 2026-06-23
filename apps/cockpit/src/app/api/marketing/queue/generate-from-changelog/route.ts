import { NextResponse } from 'next/server';

import { ensureCockpitUser, getDefaultCockpitOwnerId } from '@/lib/cockpit-tasks-store';
import { generateMarketingPostsFromChangelog } from '@/lib/marketing-queue-store';
import { getDashboardSession } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ownerId = (await getDefaultCockpitOwnerId()) ?? (await ensureCockpitUser(session.user));
  const data = await generateMarketingPostsFromChangelog(ownerId);
  return NextResponse.json({ data }, { status: 201 });
}
