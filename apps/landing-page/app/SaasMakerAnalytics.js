'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SaaSMakerClient } from '@saas-maker/sdk';

const saasmaker = new SaaSMakerClient({
  apiKey: process.env.NEXT_PUBLIC_SAASMAKER_API_KEY,
  baseUrl: 'https://api.sassmaker.com',
});

export function SaasMakerAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    saasmaker.analytics.track({ name: 'page_view', url: pathname });
  }, [pathname]);

  return null;
}
