import { HttpClient } from '../http';

// ---- Types ----

export interface IndexRecord {
  id: string;
  project_id: string;
  name: string;
  external_id: string | null;
  created_at: string;
}

export interface CreateIndexOptions {
  name: string;
  external_id?: string;
  embedding_model?: string;
}

export interface IndexListResponse {
  data: IndexRecord[];
}

export interface UploadDocumentData {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface UploadDocumentResponse {
  id: string;
  index_id: string;
  chunks_created: number;
  created_at: string;
}

export interface SearchResult {
  document_id: string;
  chunk_content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface OkResponse {
  ok: true;
}

// ---- Service ----

export class KnowledgeBaseService {
  constructor(private http: HttpClient) {}

  /** Create a new index (POST /v1/indexes). */
  createIndex(name: string, options?: { external_id?: string; embedding_model?: string }): Promise<IndexRecord> {
    return this.http.request<IndexRecord>('POST', '/v1/indexes', {
      name,
      ...options,
    });
  }

  /** List all indexes for the project (GET /v1/indexes). */
  listIndexes(): Promise<IndexListResponse> {
    return this.http.request<IndexListResponse>('GET', '/v1/indexes');
  }

  /** Upload a document to an index (POST /v1/indexes/:indexId/documents). */
  uploadDocument(indexId: string, data: UploadDocumentData): Promise<UploadDocumentResponse> {
    return this.http.request<UploadDocumentResponse>(
      'POST',
      `/v1/indexes/${encodeURIComponent(indexId)}/documents`,
      data,
    );
  }

  /** Semantic search within an index (POST /v1/indexes/:indexId/search). */
  search(indexId: string, query: string, topK?: number): Promise<SearchResponse> {
    return this.http.request<SearchResponse>(
      'POST',
      `/v1/indexes/${encodeURIComponent(indexId)}/search`,
      { query, top_k: topK },
    );
  }

  /** Delete a document from an index (DELETE /v1/indexes/:indexId/documents/:docId). */
  deleteDocument(indexId: string, docId: string): Promise<OkResponse> {
    return this.http.request<OkResponse>(
      'DELETE',
      `/v1/indexes/${encodeURIComponent(indexId)}/documents/${encodeURIComponent(docId)}`,
    );
  }

  /** Delete an entire index (DELETE /v1/indexes/:indexId). */
  deleteIndex(indexId: string): Promise<OkResponse> {
    return this.http.request<OkResponse>(
      'DELETE',
      `/v1/indexes/${encodeURIComponent(indexId)}`,
    );
  }
}
