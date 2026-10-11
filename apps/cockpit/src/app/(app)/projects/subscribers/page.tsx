import { PageHeader } from '@/components/page-header';
import { SubscribersBoard } from './subscribers-board';

export const dynamic = 'force-dynamic';

export default function SubscribersBoardPage() {
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
