import { HttpClient } from '../http';

export interface AIChatMessage {
  role: string;
  content: string;
}

export interface AIChatOptions {
  messages: AIChatMessage[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface AIRagOptions {
  index_id: string;
  query: string;
  system_prompt?: string;
  top_k?: number;
  stream?: boolean;
}

export interface AIRagResponse {
  response: string;
  sources: Array<{ document_id: string; chunk_content: string; score: number }>;
  usage: { input_tokens: number; output_tokens: number };
}

export class AIGatewayService {
  constructor(private http: HttpClient) {}

  /** Proxy chat completion to configured provider (POST /v1/ai/chat/completions). */
  chat(options: AIChatOptions): Promise<any> {
    return this.http.request<any>('POST', '/v1/ai/chat/completions', options);
  }

  /** Proxy embedding to configured provider (POST /v1/ai/embeddings). */
  embed(input: string | string[], model?: string): Promise<any> {
    return this.http.request<any>('POST', '/v1/ai/embeddings', { input, model });
  }

  /** RAG-enhanced chat (POST /v1/ai/rag). */
  rag(options: AIRagOptions): Promise<AIRagResponse> {
    return this.http.request<AIRagResponse>('POST', '/v1/ai/rag', options);
  }
}
