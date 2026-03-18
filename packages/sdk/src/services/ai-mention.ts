import { HttpClient } from '../http';

// ---- Types ----

export type AIMentionPlatform = 'openai' | 'anthropic' | 'google' | 'perplexity';
export type AIMentionSentiment = 'positive' | 'neutral' | 'negative';

export interface AIMentionCompetitor {
  name: string;
  url?: string;
}

export interface AIMentionConfig {
  id: string;
  project_id: string;
  brand_name: string;
  brand_aliases: string[];
  brand_url: string | null;
  competitors: AIMentionCompetitor[];
  platforms: AIMentionPlatform[];
  has_openai_key: boolean;
  has_anthropic_key: boolean;
  has_google_key: boolean;
  has_perplexity_key: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIMentionPrompt {
  id: string;
  project_id: string;
  prompt_text: string;
  category: string | null;
  created_at: string;
}

export interface AIMentionCheck {
  id: string;
  project_id: string;
  status: 'running' | 'completed' | 'failed';
  total_queries: number;
  completed_queries: number;
  brand_mention_rate: number | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AIMentionResult {
  id: string;
  check_id: string;
  project_id: string;
  prompt_id: string;
  platform: AIMentionPlatform;
  model: string;
  response_text: string;
  brand_mentioned: boolean;
  brand_sentiment: AIMentionSentiment | null;
  brand_position: number | null;
  competitors_mentioned: { name: string; mentioned: boolean; position: number | null }[];
  citations: string[];
  brand_cited: boolean;
  latency_ms: number | null;
  created_at: string;
}

export interface AIMentionDashboard {
  config: AIMentionConfig | null;
  prompts: AIMentionPrompt[];
  recent_checks: AIMentionCheck[];
  latest_results: AIMentionResult[];
}

export interface SaveAIMentionConfigData {
  brand_name: string;
  brand_aliases?: string[];
  brand_url?: string;
  competitors?: AIMentionCompetitor[];
  platforms?: AIMentionPlatform[];
  openai_api_key?: string;
  anthropic_api_key?: string;
  google_api_key?: string;
  perplexity_api_key?: string;
}

export interface AddAIMentionPromptData {
  prompt_text: string;
  category?: string;
}

// ---- Service ----

export class AIMentionService {
  constructor(private http: HttpClient) {}

  /** Get AI mention config for a project */
  getConfig(projectId: string): Promise<AIMentionConfig | null> {
    return this.http.request<AIMentionConfig | null>('GET', `/v1/ai-mention/config/${encodeURIComponent(projectId)}`);
  }

  /** Create or update AI mention config */
  saveConfig(projectId: string, data: SaveAIMentionConfigData): Promise<AIMentionConfig> {
    return this.http.request<AIMentionConfig>('POST', `/v1/ai-mention/config/${encodeURIComponent(projectId)}`, data);
  }

  /** Delete AI mention config */
  deleteConfig(projectId: string): Promise<{ ok: boolean }> {
    return this.http.request<{ ok: boolean }>('DELETE', `/v1/ai-mention/config/${encodeURIComponent(projectId)}`);
  }

  /** List saved prompts */
  listPrompts(projectId: string): Promise<AIMentionPrompt[]> {
    return this.http.request<AIMentionPrompt[]>('GET', `/v1/ai-mention/prompts/${encodeURIComponent(projectId)}`);
  }

  /** Add a prompt */
  addPrompt(projectId: string, data: AddAIMentionPromptData): Promise<AIMentionPrompt> {
    return this.http.request<AIMentionPrompt>('POST', `/v1/ai-mention/prompts/${encodeURIComponent(projectId)}`, data);
  }

  /** Delete a prompt */
  deletePrompt(projectId: string, promptId: string): Promise<{ ok: boolean }> {
    return this.http.request<{ ok: boolean }>('DELETE', `/v1/ai-mention/prompts/${encodeURIComponent(projectId)}/${encodeURIComponent(promptId)}`);
  }

  /** Trigger a check run */
  runCheck(projectId: string): Promise<AIMentionCheck> {
    return this.http.request<AIMentionCheck>('POST', `/v1/ai-mention/check/${encodeURIComponent(projectId)}`);
  }

  /** List past checks */
  listChecks(projectId: string): Promise<AIMentionCheck[]> {
    return this.http.request<AIMentionCheck[]>('GET', `/v1/ai-mention/checks/${encodeURIComponent(projectId)}`);
  }

  /** Get check details with results */
  getCheck(projectId: string, checkId: string): Promise<AIMentionCheck & { results: AIMentionResult[] }> {
    return this.http.request<AIMentionCheck & { results: AIMentionResult[] }>('GET', `/v1/ai-mention/checks/${encodeURIComponent(projectId)}/${encodeURIComponent(checkId)}`);
  }

  /** Get full dashboard data */
  getDashboard(projectId: string): Promise<AIMentionDashboard> {
    return this.http.request<AIMentionDashboard>('GET', `/v1/ai-mention/dashboard/${encodeURIComponent(projectId)}`);
  }
}
