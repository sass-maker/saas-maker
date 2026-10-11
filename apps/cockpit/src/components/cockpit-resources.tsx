'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  createResourceClient,
  useResource,
  type ResourceOptions,
} from '@saas-maker/ui/lib/use-resource';
import type { ProjectRecord } from '@saas-maker/contracts';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';

export function createCockpitResources() {
  const client = createResourceClient();
  const paths = new Set<string>();
  return {
    client,
    paths,
    invalidate(prefix: string) {
      for (const path of paths) {
        if (path.startsWith(prefix)) client.invalidate(path);
      }
    },
  };
}

const ResourcesContext = createContext<ReturnType<typeof createCockpitResources> | null>(null);

/** The authenticated layout keeps one memory-only cache alive across route visits. */
export function CockpitResources({ children }: { children: ReactNode }) {
  const resources = useMemo(createCockpitResources, []);
  return <ResourcesContext.Provider value={resources}>{children}</ResourcesContext.Provider>;
}

export function useCockpitResources() {
  const resources = useContext(ResourcesContext);
  if (!resources) throw new Error('cockpit resources require an authenticated layout');
  return resources;
}

export function useApiResource<T>(path: string, options: ResourceOptions<T> = {}) {
  const { client, paths } = useCockpitResources();
  useEffect(() => {
    paths.add(path);
  }, [path, paths]);
  return useResource<T>(
    path,
    async (signal) => apiFetchClient<T>(path, await getClientToken(signal), { signal }),
    { staleTime: 0, ...options, client }
  );
}

export function useProjectsResource() {
  return useApiResource<{ data: ProjectRecord[] }>('/v1/projects', {
    isEmpty: (result) => visibleDashboardProjects(result.data ?? []).length === 0,
  });
}
