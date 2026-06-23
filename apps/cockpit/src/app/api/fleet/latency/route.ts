import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/server-session';
import { getFleetLatency } from '@/lib/posthog-server';

export async function GET(req: Request) {
  const session = await getDashboardSession(req.headers);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const latency = await getFleetLatency();
    return NextResponse.json({ latency });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch latency map', detail: String(err) },
      { status: 500 }
    );
  }
}
