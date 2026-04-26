'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SaaSMakerClient } from '@saas-maker/sdk';

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.NEXT_PUBLIC_SAASMAKER_API_KEY;
  if (!apiKey) return null;
  _client = new SaaSMakerClient({ apiKey, baseUrl: 'https://api.sassmaker.com' });
  return _client;
}

export function SaasMakerAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    const client = getClient();
    if (!client) return;
    client.analytics.track({ name: 'page_view', url: pathname });
  }, [pathname]);

  return null;
}
