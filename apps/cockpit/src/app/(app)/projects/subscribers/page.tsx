import { PageHeader } from '@/components/page-header';
import { SubscribersBoard } from './subscribers-board';
import { getDashboardSession } from '@/lib/server-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SubscribersBoardPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');
  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscribers"
        description="Consented newsletter and waitlist sign-ups captured across products."
      />
      <SubscribersBoard />
    </div>
  );
}
