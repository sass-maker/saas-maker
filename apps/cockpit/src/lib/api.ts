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
  const { getLocalSessionToken, isLocalAuthBypassEnabled } = await import('./local-auth');
  const { headers } = await import('next/headers');
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get('host'))) {
    return getLocalSessionToken();
  }

  const { auth } = await import('./auth');
  const session = await auth.api.getSession({ headers: requestHeaders });
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
