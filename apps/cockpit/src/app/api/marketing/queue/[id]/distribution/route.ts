import { NextResponse } from 'next/server';

import { updateMarketingDistributionApproval } from '@/lib/marketing-distribution-envelope';
import { getMarketingPost, updateMarketingPost } from '@/lib/marketing-queue-store';
import { getDashboardSession } from '@/lib/server-session';

export const dynamic = 'force-dynamic';
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const post = await getMarketingPost(id);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    scheduled_for?: unknown;
  } | null;
  if (body?.action !== 'approve' && body?.action !== 'reject')
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  try {
    const notes = updateMarketingDistributionApproval(post.notes ?? '', {
      action: body.action,
      actor: session.user.email ?? session.user.name ?? session.user.id,
      scheduledFor: typeof body.scheduled_for === 'string' ? body.scheduled_for : null,
    });
    const data = await updateMarketingPost(id, {
      notes,
      scheduled_for:
        body.action === 'approve'
          ? typeof body.scheduled_for === 'string'
            ? new Date(body.scheduled_for).toISOString()
            : new Date().toISOString()
          : null,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Distribution approval failed' },
      { status: 400 }
    );
  }
}
