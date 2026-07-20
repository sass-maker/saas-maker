import { NextResponse } from 'next/server';

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
