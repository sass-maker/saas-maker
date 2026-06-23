import { API_BASE, API_FALLBACK_BASES } from './api-base';

async function fetchJsonWithFallback<T>(path: string, init: RequestInit): Promise<T> {
  let lastError: Error | null = null;
  for (const base of API_FALLBACK_BASES) {
    try {
      const res = await fetch(`${base}${path}`, init);
      if (res.ok) return res.json() as Promise<T>;
      const body = await res.text();
      const retriable = res.status === 530 || body.includes('error code: 1003');
      if (!retriable || base === API_FALLBACK_BASES.at(-1)) {
        throw new Error(body);
      }
      lastError = new Error(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown fetch error';
      lastError = new Error(`${message} (${base}${path})`);
      if (base !== API_FALLBACK_BASES.at(-1)) continue;
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${API_BASE}${path}`);
}

/** Server-side fetch with session token auto-attached */
export async function apiFetchAuthed<T>(path: string, init?: RequestInit): Promise<T> {
  const { getServerToken } = await import('./api');
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
export async function getClientToken(): Promise<string> {
  const res = await fetch('/api/token');
  if (!res.ok) throw new Error('Failed to get auth token');
  const data = await res.json();
  return data.token;
}
