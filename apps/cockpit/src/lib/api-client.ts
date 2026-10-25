import { API_BASE, API_FALLBACK_BASES } from './api-base';

export async function fetchJsonWithFallback<T>(path: string, init: RequestInit): Promise<T> {
  let lastError: Error | null = null;
  for (const base of API_FALLBACK_BASES) {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, init);
    } catch (error) {
      if (init.signal?.aborted || (error instanceof Error && error.name === 'AbortError'))
        throw error;
      // Keep TypeError intact so useResource recognises network failures.
      lastError = error instanceof Error ? error : new Error('request failed');
      if (base !== API_FALLBACK_BASES.at(-1)) continue;
      throw lastError;
    }
    if (res.ok) return res.json() as Promise<T>;
    const body = await res.text();
    const error = Object.assign(new Error(body || 'request failed'), { status: res.status });
    if (res.status === 530 || (res.status >= 500 && body.includes('error code: 1003'))) {
      lastError = error;
      continue;
    }
    throw error;
  }
  throw lastError ?? new Error(`Failed to fetch ${API_BASE}${path}`);
}

/** Client-side fetch — pass token from getClientToken() */
export async function apiFetchClient<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  return fetchJsonWithFallback<T>(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Get auth token from client-side /api/token endpoint */
export async function getClientToken(signal?: AbortSignal): Promise<string> {
  const res = await fetch('/api/token', { signal });
  if (!res.ok) {
    throw Object.assign(new Error('Failed to get auth token'), { status: res.status });
  }
  const data = await res.json();
  return data.token;
}
