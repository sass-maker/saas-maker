'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getSaasmaker } from '@/lib/saasmaker';

export function SaasMakerAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      getSaasmaker().analytics.track({ name: 'page_view', url: pathname });
    } catch {
      // SDK not configured (missing api key) — analytics disabled
    }
  }, [pathname]);

  return null;
}
