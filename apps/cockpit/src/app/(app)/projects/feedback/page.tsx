import { PageHeader } from '@/components/page-header';
import { FeedbackBoard } from './feedback-board';

export const dynamic = 'force-dynamic';

export default function FeedbackBoardPage() {
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
