'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getSaasmaker } from '@/lib/saasmaker';
import { trackSession } from '@/lib/analytics';

export function SaasMakerAnalytics() {
  const pathname = usePathname();

  // Owner-facing 4-event taxonomy: emits `signup` on the first ever session
  // and `returned` on later sessions for users with prior activity.
  // Self-dedupes per session; safe to run once per app mount.
  useEffect(() => {
    trackSession();
  }, []);

  useEffect(() => {
    try {
      getSaasmaker().analytics.track({ name: 'page_view', url: pathname });
    } catch {
      // SDK not configured (missing api key) — analytics disabled
    }
  }, [pathname]);

  return null;
}
