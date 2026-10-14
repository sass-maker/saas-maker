'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  createResourceClient,
  useResource,
  type ResourceOptions,
} from '@saas-maker/ui/lib/use-resource';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { visibleDashboardProjects, type DashboardProject } from '@/lib/dashboard-projects';

export interface ResourceSeed<T> {
  initialData?: T;
  initialDataUpdatedAt?: number;
}

export function createCockpitResources() {
  const client = createResourceClient();
  const paths = new Set<string>();
  return {
    client,
    paths,
    seed<T>(path: string, { initialData, initialDataUpdatedAt }: ResourceSeed<T>) {
      const entry = client.entry(path);
      // The shared hook has no timestamp option. Seed before it reads the cache,
      // preserving any data already fetched or mutated in this account's session.
      if (initialData !== undefined && entry.snapshot.data === undefined) {
        entry.snapshot = {
          data: initialData,
          error: undefined,
          fetching: entry.snapshot.fetching,
          updated: initialDataUpdatedAt ?? Date.now(),
        };
      }
    },
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

export function useApiResource<T>(
  path: string,
  options: ResourceOptions<T> & ResourceSeed<T> = {}
) {
  const { client, paths, seed } = useCockpitResources();
  seed(path, options);
  useEffect(() => {
    paths.add(path);
  }, [path, paths]);
  return useResource<T>(
    path,
    async (signal) => apiFetchClient<T>(path, await getClientToken(signal), { signal }),
    { staleTime: 0, ...options, client }
  );
}

export function useProjectsResource(options: ResourceSeed<{ data: DashboardProject[] }> = {}) {
  return useApiResource<{ data: DashboardProject[] }>('/v1/projects', {
    ...options,
    isEmpty: (result) => visibleDashboardProjects(result.data ?? []).length === 0,
  });
}
