import { getApiBase, getApiKey, getLocalProjectKey } from './config.js';

export type AuthMode = 'auto' | 'session' | 'project' | 'none';
export type QueryPrimitive = string | number | boolean | null | undefined;
export type QueryValue = QueryPrimitive | QueryPrimitive[];

export interface RequestApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  auth?: AuthMode;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string;
  projectKey?: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  url: string;
  data: T | undefined;
  text: string | undefined;
}

function buildUrl(pathInput: string, query?: Record<string, QueryValue>): string {
  const base = getApiBase().replace(/\/+$/, '');
  const path = pathInput.startsWith('/') ? pathInput : `/${pathInput}`;
  const url = new URL(`${base}${path}`);

  for (const [key, raw] of Object.entries(query ?? {})) {
    if (raw === undefined || raw === null) continue;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item === undefined || item === null) continue;
        url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.set(key, String(raw));
  }

  return url.toString();
}

function resolveAuthHeaders(options: RequestApiOptions): Record<string, string> {
  const mode = options.auth ?? 'auto';
  const token = options.token ?? getApiKey() ?? '';
  const projectKey = options.projectKey ?? getLocalProjectKey() ?? '';
  const headers: Record<string, string> = {};

  if (mode === 'none') return headers;
  if (mode === 'session') {
    if (!token) throw new Error('No session token found. Run `saasmaker login` first.');
    headers.Authorization = `Bearer ${token}`;
    return headers;
  }
  if (mode === 'project') {
    if (!projectKey) throw new Error('No project key found. Run `saasmaker init` first or pass --project-key.');
    headers['X-Project-Key'] = projectKey;
    return headers;
  }

  if (token) headers.Authorization = `Bearer ${token}`;
  if (projectKey) headers['X-Project-Key'] = projectKey;
  if (!token && !projectKey) {
    throw new Error('No auth context found. Run `saasmaker login` and/or `saasmaker init`.');
  }
  return headers;
}

function resolveRequestBody(options: RequestApiOptions, headers: Record<string, string>): BodyInit | undefined {
  if (options.body === undefined || options.body === null) return undefined;
  if (typeof options.body === 'string') return options.body;
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return JSON.stringify(options.body);
}

export async function requestApi<T = unknown>(options: RequestApiOptions): Promise<ApiResponse<T>> {
  const method = options.method ?? 'GET';
  const url = buildUrl(options.path, options.query);
  const headers = {
    ...resolveAuthHeaders(options),
    ...(options.headers ?? {}),
  };
  const body = resolveRequestBody(options, headers);

  const res = await fetch(url, { method, headers, body });
  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = (await res.json().catch(() => undefined)) as T | undefined;
    return {
      ok: res.ok,
      status: res.status,
      url,
      data,
      text: undefined,
    };
  }

  const text = await res.text().catch(() => '');
  return {
    ok: res.ok,
    status: res.status,
    url,
    data: undefined,
    text: text || undefined,
  };
}

export function getResponseError(response: ApiResponse<unknown>): string {
  if (response.data && typeof response.data === 'object' && 'error' in response.data) {
    const error = (response.data as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  if (response.text && response.text.trim()) return response.text.trim();
  return `API error: ${response.status}`;
}
