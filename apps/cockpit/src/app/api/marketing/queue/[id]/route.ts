import { NextResponse } from 'next/server';

import {
  deleteMarketingPost,
  type MarketingPostInput,
  updateMarketingPost,
} from '@/lib/marketing-queue-store';
import { getDashboardSession } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as MarketingPostInput | null;
  if (!body) return NextResponse.json({ error: 'body is required' }, { status: 400 });
  const data = await updateMarketingPost(id, body);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(req: Request, context: RouteContext) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const ok = await deleteMarketingPost(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
