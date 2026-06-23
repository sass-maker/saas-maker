import { getDashboardSession } from '@/lib/server-session';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { FeedbackBoard } from './feedback-board';

export const dynamic = 'force-dynamic';

export default async function FeedbackBoardPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Requests"
        description="All feature requests across your projects"
      />
      <FeedbackBoard />
    </div>
  );
}
