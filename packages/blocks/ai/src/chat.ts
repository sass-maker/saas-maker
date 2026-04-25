import { trace, FoundryError } from '@saas-maker/ops';
import type { AIConfig } from './types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  config: AIConfig;
  messages: ChatMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  stream?: boolean;
  headers?: Record<string, string>;
}

/**
 * Build the full chat completions URL from a base endpoint.
 */
export function buildChatUrl(endpointUrl: string): string {
  const base = endpointUrl.trim().replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/**
 * Raw fetch to an OpenAI-compatible chat completions endpoint.
 * Automatically traced via @saas-maker/ops.
 */
export async function fetchChatCompletion(
  options: ChatCompletionOptions,
): Promise<Response> {
  const {
    config,
    messages,
    systemPrompt,
    maxTokens = 4096,
    stream = true,
    headers: extraHeaders = {},
  } = options;

  return trace(`ai:completion:${config.model}`, async () => {
    const url = buildChatUrl(config.endpointUrl);

    const allMessages: ChatMessage[] = [];
    if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
    allMessages.push(...messages);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model: config.model,
        messages: allMessages,
        max_tokens: maxTokens,
        stream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new FoundryError(`AI Provider Error: ${response.statusText}`, {
        code: 'AI_PROVIDER_ERROR',
        severity: 'error',
        context: { status: response.status, errorText, model: config.model },
      });
    }

    return response;
  }, { context: { model: config.model } });
}

/**
 * Parse an SSE stream from an OpenAI-compatible endpoint.
 */
export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const json = JSON.parse(line.slice(6));
        const content = json.choices?.[0]?.delta?.content;
        if (content) yield content;
      } catch {
        // skip malformed
      }
    }
  }
}
