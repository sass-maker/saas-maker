export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatOptions {
  config: LLMConfig;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export async function chatCompletion(options: ChatOptions): Promise<Response> {
  const { config, messages, stream = false, temperature, max_tokens } = options;
  const body: Record<string, unknown> = { model: config.model, messages, stream };
  if (temperature !== undefined) body.temperature = temperature;
  if (max_tokens !== undefined) body.max_tokens = max_tokens;

  return fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'x-gateway-project-id': 'saas-maker',
    },
    body: JSON.stringify(body),
  });
}

export async function embeddings(config: LLMConfig, input: string | string[], model?: string): Promise<Response> {
  return fetch(`${config.baseUrl.replace(/\/+$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'x-gateway-project-id': 'saas-maker',
    },
    body: JSON.stringify({ model: model || config.model, input }),
  });
}

export function parseUsage(data: any): { input_tokens: number; output_tokens: number } {
  const usage = data?.usage;
  return {
    input_tokens: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
    output_tokens: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
  };
}
