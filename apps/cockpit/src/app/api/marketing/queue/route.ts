import { NextResponse } from 'next/server';

import { ensureCockpitUser, getDefaultCockpitOwnerId } from '@/lib/cockpit-tasks-store';
import {
  createMarketingPost,
  listMarketingPosts,
  type MarketingPostInput,
} from '@/lib/marketing-queue-store';
import { getDashboardSession } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const data = await listMarketingPosts({
    status: url.searchParams.get('status') || undefined,
    project_slug: url.searchParams.get('project') || undefined,
    channel: url.searchParams.get('channel') || undefined,
  });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as MarketingPostInput | null;
  if (!body?.title || !body.body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
  }
  const ownerId = (await getDefaultCockpitOwnerId()) ?? (await ensureCockpitUser(session.user));
  const data = await createMarketingPost(ownerId, body);
  return NextResponse.json({ data }, { status: 201 });
}
