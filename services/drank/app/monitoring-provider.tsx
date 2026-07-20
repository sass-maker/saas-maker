'use client';

import { useEffect } from 'react';
import { installBrowserMonitoring } from '@/lib/foundry-monitoring';
import { initApiTiming } from '@/lib/api-timing';

export function MonitoringProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cleanup = installBrowserMonitoring();
    initApiTiming();
    return cleanup;
  }, []);

  return <>{children}</>;
}
