import type { Bindings } from '../types';

export type RagBackend = 'local' | 'dual' | 'service';

export interface RagVectorChunk {
  id: string;
  document_id: string;
  document_content?: string;
  content: string;
  embedding: number[];
  chunk_index: number;
  metadata?: Record<string, unknown>;
}

export interface RagSearchResult {
  document_id: string;
  chunk_id?: string;
  chunk_content: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface RagIndexInput {
  id: string;
  name: string;
}

const RAG_INDEX_CACHE_TTL_MS = 300_000;
const ragIndexCache = new Map<string, { id: string; expiresAt: number }>();

function normalizeBaseUrl(value: string | undefined): string {
  return (value || '').trim().replace(/\/+$/, '');
}

function indexCacheKey(env: Bindings, input: RagIndexInput): string {
  const target = env.RAG_SERVICE ? 'binding:rag-service' : normalizeBaseUrl(env.RAG_SERVICE_URL);
  return `${target}:${env.RAG_SERVICE_KEY?.trim() || ''}:${input.id}`;
}

function getCachedRagIndexId(env: Bindings, input: RagIndexInput): string | null {
  const key = indexCacheKey(env, input);
  const cached = ragIndexCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    ragIndexCache.delete(key);
    return null;
  }
  return cached.id;
}

function setCachedRagIndexId(env: Bindings, input: RagIndexInput, id: string): void {
  ragIndexCache.set(indexCacheKey(env, input), { id, expiresAt: Date.now() + RAG_INDEX_CACHE_TTL_MS });
}

function deleteCachedRagIndexId(env: Bindings, input: RagIndexInput): void {
  ragIndexCache.delete(indexCacheKey(env, input));
}

export function getRagBackend(env: Bindings): RagBackend {
  const value = (env.RAG_BACKEND || 'local').toLowerCase();
  return value === 'dual' || value === 'service' ? value : 'local';
}

export function isRagServiceConfigured(env: Bindings): boolean {
  return Boolean((env.RAG_SERVICE || normalizeBaseUrl(env.RAG_SERVICE_URL)) && env.RAG_SERVICE_KEY?.trim());
}

async function requestJson<T>(
  env: Bindings,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const baseUrl = normalizeBaseUrl(env.RAG_SERVICE_URL);
  const key = env.RAG_SERVICE_KEY?.trim();
  if ((!env.RAG_SERVICE && !baseUrl) || !key) throw new Error('RAG service is not configured');

  const requestInit = {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  };
  const res = await (env.RAG_SERVICE
    ? env.RAG_SERVICE.fetch(new Request(`https://rag-service.internal${path}`, requestInit))
    : fetch(`${baseUrl}${path}`, requestInit));
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || `RAG service request failed with ${res.status}`);
  }
  return payload;
}

export async function ensureRagIndex(env: Bindings, input: RagIndexInput): Promise<string> {
  const cached = getCachedRagIndexId(env, input);
  if (cached) return cached;

  const listed = await requestJson<{ data?: Array<{ id: string; name: string; external_id?: string | null }> }>(
    env,
    '/v1/indexes',
  );
  const existing = (listed.data || []).find((index) => index.external_id === input.id);
  if (existing) {
    setCachedRagIndexId(env, input, existing.id);
    return existing.id;
  }

  const created = await requestJson<{ id: string }>(env, '/v1/indexes', {
    method: 'POST',
    body: { name: input.name, external_id: input.id },
  });
  setCachedRagIndexId(env, input, created.id);
  return created.id;
}

export async function ingestRagVectors(
  env: Bindings,
  index: RagIndexInput,
  chunks: RagVectorChunk[],
): Promise<number> {
  if (chunks.length === 0) return 0;
  const ragIndexId = await ensureRagIndex(env, index);
  const result = await requestJson<{ upserted?: number }>(env, `/v1/indexes/${ragIndexId}/ingest-vectors`, {
    method: 'POST',
    body: { chunks },
  });
  return result.upserted || 0;
}

export async function deleteRagDocument(env: Bindings, documentId: string): Promise<void> {
  await requestJson(env, `/v1/documents/${documentId}`, { method: 'DELETE' });
}

export async function deleteRagIndex(env: Bindings, index: RagIndexInput): Promise<void> {
  const ragIndexId = await ensureRagIndex(env, index);
  await requestJson(env, `/v1/indexes/${ragIndexId}`, { method: 'DELETE' });
  deleteCachedRagIndexId(env, index);
}

export async function searchRag(
  env: Bindings,
  index: RagIndexInput,
  query: string,
  topK: number,
): Promise<RagSearchResult[]> {
  const ragIndexId = await ensureRagIndex(env, index);
  const result = await requestJson<{ data?: RagSearchResult[] }>(env, `/v1/indexes/${ragIndexId}/query`, {
    method: 'POST',
    body: { query, top_k: topK },
  });
  return result.data || [];
}
