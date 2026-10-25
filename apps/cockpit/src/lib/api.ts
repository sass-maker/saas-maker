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
