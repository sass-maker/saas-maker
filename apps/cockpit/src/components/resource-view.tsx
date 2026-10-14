'use client';

import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { ResourceBoundary, type BoundaryResource } from '@saas-maker/ui/blocks/resource-boundary';
import { ErrorState } from '@saas-maker/ui/components/error-state';

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function LoadError({ retry }: { retry: () => Promise<void> }) {
  const offline = useSyncExternalStore(
    subscribeOnline,
    () => !navigator.onLine,
    () => false
  );
  return <ErrorState offline={offline} onRetry={() => void retry()} />;
}

export function ResourceView<T>({
  resource,
  skeleton,
  empty,
  children,
}: {
  resource: BoundaryResource<T>;
  skeleton: ReactNode;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  // ResourceBoundary's delay is effect-based even at zero; render cold placeholders
  // in server HTML so slow hydration cannot leave the content area blank.
  if (resource.status === 'loading' && resource.data === undefined) {
    return (
      <div className="min-w-0" aria-busy="true">
        {skeleton}
      </div>
    );
  }
  const cachedError = resource.status === 'error' && resource.data !== undefined;
  return (
    <div className="min-w-0">
      <ResourceBoundary
        resource={cachedError ? { ...resource, status: 'success', error: undefined } : resource}
        skeleton={skeleton}
        empty={empty}
        error={<LoadError retry={resource.retry} />}
        delay={0}
      >
        {children}
      </ResourceBoundary>
      {cachedError && <LoadError retry={resource.retry} />}
    </div>
  );
}
