import { NextResponse } from 'next/server';

import { apiFetch } from '@/lib/api';
import { getDashboardSession } from '@/lib/server-session';
import { getSpeedSnapshot } from '@/lib/speed-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getDashboardSession(request.headers);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getSpeedSnapshot();
  return NextResponse.json(
    { data },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie, Authorization',
      },
    }
  );
}

export async function POST(request: Request) {
  const session = await getDashboardSession(request.headers);
  const token = session?.session?.token;
  if (!session?.user || !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > 32_768) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const result = await apiFetch(
      '/v1/performance/budgets/approve',
      { method: 'POST', body: JSON.stringify(body), cache: 'no-store' },
      token
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Budget activation failed' },
      { status: 502 }
    );
  }
}
