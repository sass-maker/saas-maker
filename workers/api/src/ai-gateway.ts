import type { AIProviderConfig } from '@saas-maker/shared-types';

export interface StoredAIConfig {
  ai_base_url: string | null;
  ai_api_key: string | null;
  ai_model: string | null;
}

export function maskProviderKey(apiKey: string | null | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return '****';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

export function toPublicAIConfig(config: StoredAIConfig): AIProviderConfig {
  return {
    ai_base_url: config.ai_base_url,
    ai_model: config.ai_model,
    ai_api_key_configured: Boolean(config.ai_api_key),
    ai_api_key_preview: maskProviderKey(config.ai_api_key),
  };
}

export function buildProviderEndpoint(baseUrl: string, endpoint: 'chat/completions' | 'embeddings'): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base.endsWith(`/${endpoint}`)) return base;
  if (base.endsWith('/v1')) return `${base}/${endpoint}`;
  return `${base}/v1/${endpoint}`;
}

export function truncateProviderError(message: string | null, maxLength = 500): string | null {
  if (!message) return null;
  return message.length > maxLength ? `${message.slice(0, maxLength)}...` : message;
}

export function extractUsageTokens(payload: unknown): {
  inputTokens: number | null;
  outputTokens: number | null;
} {
  if (!payload || typeof payload !== 'object' || !('usage' in payload)) {
    return { inputTokens: null, outputTokens: null };
  }

  const usage = (payload as { usage?: Record<string, unknown> }).usage;
  if (!usage) return { inputTokens: null, outputTokens: null };

  const input =
    typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : typeof usage.prompt_tokens === 'number'
        ? usage.prompt_tokens
        : null;

  const output =
    typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : typeof usage.completion_tokens === 'number'
        ? usage.completion_tokens
        : null;

  return { inputTokens: input, outputTokens: output };
}
