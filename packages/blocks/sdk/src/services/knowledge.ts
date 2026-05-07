import { HttpClient } from '../http';

// ---- Types ----

export interface IndexRecord {
  id: string;
  project_id: string;
  name: string;
  external_id: string | null;
  document_count: number;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  index_id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SearchResult {
  document_id: string;
  chunk_content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ---- Service ----

export class KnowledgeService {
  constructor(private http: HttpClient) {}

  /** Create a new knowledge index (POST /v1/knowledge/indexes). Requires session auth. */
  createIndex(projectId: string, name: string, externalId?: string): Promise<IndexRecord> {
    return this.http.request<IndexRecord>('POST', '/v1/knowledge/indexes', { project_id: projectId, name, external_id: externalId });
  }

  /** List indexes for a project (GET /v1/knowledge/indexes?project_id=...). Requires session auth. */
  listIndexes(projectId: string): Promise<{ data: IndexRecord[] }> {
    return this.http.request<{ data: IndexRecord[] }>('GET', `/v1/knowledge/indexes?project_id=${projectId}`);
  }

  /** Delete an index (DELETE /v1/knowledge/indexes/:id). Requires session auth. */
  deleteIndex(id: string): Promise<{ ok: true }> {
    return this.http.request<{ ok: true }>('DELETE', `/v1/knowledge/indexes/${id}`);
  }

  /** Ingest a document into an index (POST /v1/knowledge/indexes/:id/documents). Requires API key. */
  ingestDocument(indexId: string, content: string, metadata?: Record<string, unknown>): Promise<DocumentRecord & { chunks_created: number }> {
    return this.http.request<DocumentRecord & { chunks_created: number }>('POST', `/v1/knowledge/indexes/${indexId}/documents`, { content, metadata });
  }

  /** List documents in an index (GET /v1/knowledge/indexes/:id/documents). Requires API key. */
  listDocuments(indexId: string, page = 1): Promise<PaginatedResponse<DocumentRecord>> {
    return this.http.request<PaginatedResponse<DocumentRecord>>('GET', `/v1/knowledge/indexes/${indexId}/documents?page=${page}`);
  }

  /** Delete a document (DELETE /v1/knowledge/documents/:id). Requires API key. */
  deleteDocument(id: string): Promise<{ ok: true }> {
    return this.http.request<{ ok: true }>('DELETE', `/v1/knowledge/documents/${id}`);
  }

  /** Semantic search (POST /v1/knowledge/indexes/:id/search). Requires API key. */
  search(indexId: string, query: string, topK = 5): Promise<{ data: SearchResult[] }> {
    return this.http.request<{ data: SearchResult[] }>('POST', `/v1/knowledge/indexes/${indexId}/search`, { query, top_k: topK });
  }
}
