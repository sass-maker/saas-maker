import { redirect } from 'next/navigation';

import { SpeedWorkspace } from '@/components/speed/speed-workspace';
import { getDashboardSession } from '@/lib/server-session';
import { getSpeedSnapshot } from '@/lib/speed-data';

export const dynamic = 'force-dynamic';

export default async function FleetSpeedPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  const snapshot = await getSpeedSnapshot();
  return <SpeedWorkspace snapshot={snapshot} />;
}
