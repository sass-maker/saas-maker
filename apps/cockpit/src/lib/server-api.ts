import 'server-only';
import type { ProjectRecord } from '@saas-maker/contracts';
import { fetchJsonWithFallback } from './api-client';
import { getDashboardSession } from './server-session';

/** Get the authenticated session token for a server-rendered request. */
export async function getServerToken(): Promise<string | undefined> {
  const session = await getDashboardSession();
  return session?.session?.token;
}

/** Server-side fetch with the current request's session token attached. */
export async function apiFetchAuthed<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getServerToken();

  return fetchJsonWithFallback<T>(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/** Resolve a project by slug in one server-side API call. */
export async function getProjectBySlug(
  slug: string,
  token?: string
): Promise<ProjectRecord | null> {
  try {
    return await fetchJsonWithFallback<ProjectRecord>(`/v1/projects/by-slug/${slug}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) return null;
    throw error;
  }
}
