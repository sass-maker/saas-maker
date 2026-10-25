import { PageHeader } from '@/components/page-header';
import { FeedbackBoard } from './feedback-board';
import { getDashboardSession } from '@/lib/server-session';
import { apiFetchAuthed } from '@/lib/api-client';
import { redirect } from 'next/navigation';
import type { FeedbackBoardSeed, FeedbackInboxData } from './feedback-board';

export const dynamic = 'force-dynamic';

export default async function FeedbackBoardPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');
  let seed: FeedbackBoardSeed = {};
  try {
    seed = {
      initialData: await apiFetchAuthed<FeedbackInboxData>('/v1/feedback?', { cache: 'no-store' }),
      initialDataUpdatedAt: Date.now(),
    };
  } catch {
    // Leave the resource unseeded so its normal client request can retry and surface errors.
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback inbox"
        description="Review customer requests across products using the SaaS Maker feedback package."
      />
      <FeedbackBoard {...seed} />
    </div>
  );
}
