import { HttpClient } from '../http';

export interface AIProviderConfig {
  ai_base_url: string | null;
  ai_model: string | null;
  ai_api_key_configured: boolean;
  ai_api_key_preview: string | null;
}

export interface UpdateAIConfigRequest {
  ai_base_url: string;
  ai_model: string;
  ai_api_key?: string | null;
}

export interface AIChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

export interface AIEmbeddingRequest {
  input: string | string[];
  model?: string;
  [key: string]: unknown;
}

export interface AIRequestRecord {
  id: string;
  project_id: string;
  endpoint: string;
  model: string;
  status: 'success' | 'error' | 'timeout';
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  created_at: string;
}

export interface AIUsageStats {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
}

export interface AIRequestsResponse {
  data: AIRequestRecord[];
  total: number;
  limit: number;
  offset: number;
}

function projectQuery(projectId: string): string {
  return `project_id=${encodeURIComponent(projectId)}`;
}

export class AIService {
  constructor(private http: HttpClient) {}

  /** Proxy a chat completion through the project's configured provider. */
  chatCompletions<T = unknown>(data: AIChatCompletionRequest): Promise<T> {
    return this.http.request<T>('POST', '/v1/ai/chat/completions', data);
  }

  /** Proxy a streaming chat completion and return the raw Response. */
  streamChatCompletions(data: AIChatCompletionRequest): Promise<Response> {
    return this.http.requestRaw('POST', '/v1/ai/chat/completions', { ...data, stream: true });
  }

  /** Proxy embeddings through the project's configured provider. */
  embeddings<T = unknown>(data: AIEmbeddingRequest): Promise<T> {
    return this.http.request<T>('POST', '/v1/ai/embeddings', data);
  }

  /** Read masked provider config. Requires a session token. */
  getConfig(projectId: string): Promise<AIProviderConfig> {
    return this.http.request<AIProviderConfig>('GET', `/v1/ai/config?${projectQuery(projectId)}`, undefined, { auth: 'session' });
  }

  /** Create or update provider config. Requires a session token. */
  updateConfig(projectId: string, data: UpdateAIConfigRequest): Promise<AIProviderConfig> {
    return this.http.request<AIProviderConfig>('PUT', `/v1/ai/config?${projectQuery(projectId)}`, data, { auth: 'session' });
  }

  /** Clear provider config and stored provider key. Requires a session token. */
  deleteConfig(projectId: string): Promise<{ ok: true }> {
    return this.http.request<{ ok: true }>('DELETE', `/v1/ai/config?${projectQuery(projectId)}`, undefined, { auth: 'session' });
  }

  /** Read usage totals. Requires a session token. */
  getUsage(projectId: string, days = 30): Promise<AIUsageStats> {
    const params = `${projectQuery(projectId)}&days=${encodeURIComponent(String(days))}`;
    return this.http.request<AIUsageStats>('GET', `/v1/ai/usage?${params}`, undefined, { auth: 'session' });
  }

  /** List recent proxied requests. Requires a session token. */
  listRequests(projectId: string, options: { limit?: number; offset?: number } = {}): Promise<AIRequestsResponse> {
    const params = new URLSearchParams({ project_id: projectId });
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    return this.http.request<AIRequestsResponse>('GET', `/v1/ai/requests?${params}`, undefined, { auth: 'session' });
  }
}
