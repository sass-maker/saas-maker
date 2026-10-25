import { fetchJsonWithFallback } from './api-client';

export async function apiFetch(path: string, options: RequestInit = {}, token?: string) {
  return fetchJsonWithFallback<any>(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Get the auth session token (server-side only).
 * Uses better-auth session token for API calls.
 */
export async function getServerToken(): Promise<string | undefined> {
  const { getDashboardSession } = await import('./server-session');
  const session = await getDashboardSession();
  return session?.session?.token;
}

/**
 * Resolve a project by slug (single API call instead of fetching all projects).
 * Server-side only.
 */
export async function getProjectBySlug(
  slug: string,
  token?: string
): Promise<import('@saas-maker/contracts').ProjectRecord | null> {
  try {
    return await apiFetch(`/v1/projects/by-slug/${slug}`, {}, token);
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) return null;
    throw error;
  }
}
