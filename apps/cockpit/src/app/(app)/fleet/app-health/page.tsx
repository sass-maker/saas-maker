import { redirect } from 'next/navigation';

import { AppHealthWorkspace } from '@/components/app-health/app-health-workspace';
import { getDashboardSession } from '@/lib/server-session';
import { getSpeedSnapshot } from '@/lib/speed-data';

export const dynamic = 'force-dynamic';

export default async function AppHealthPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  const snapshot = await getSpeedSnapshot();
  return <AppHealthWorkspace snapshot={snapshot} />;
}
