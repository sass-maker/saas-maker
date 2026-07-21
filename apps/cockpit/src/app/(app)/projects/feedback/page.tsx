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
        title="Feedback inbox"
        description="Review customer requests across products using the SaaS Maker feedback package."
      />
      <FeedbackBoard />
    </div>
  );
}
