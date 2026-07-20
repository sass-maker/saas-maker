import { notFound } from 'next/navigation';

import { appHealthScreenshotFixture } from '@/components/app-health/app-health-fixture';
import { AppHealthWorkspace } from '@/components/app-health/app-health-workspace';

export const dynamic = 'force-dynamic';

export default function AppHealthScreenshotPage() {
  if (process.env.NODE_ENV !== 'development' && process.env.APP_HEALTH_SCREENSHOT_MODE !== '1') {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-10">
      <style>{'nextjs-portal { display: none !important; }'}</style>
      <div className="mx-auto max-w-[1500px]">
        <AppHealthWorkspace snapshot={appHealthScreenshotFixture} />
      </div>
    </main>
  );
}
