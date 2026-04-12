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
 * Handles: /v1, /v1/chat/completions, bare URLs.
 */
export function buildChatUrl(endpointUrl: string): string {
  const base = endpointUrl.trim().replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/**
 * Raw fetch to an OpenAI-compatible chat completions endpoint.
 * Works in any runtime (Node, Workers, browser). Returns the raw Response
 * so callers can handle streaming or JSON parsing as needed.
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

  const url = buildChatUrl(config.endpointUrl);

  const allMessages: ChatMessage[] = [];
  if (systemPrompt) allMessages.push({ role: 'system', content: systemPrompt });
  allMessages.push(...messages);

  return fetch(url, {
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
}

/**
 * Parse an SSE stream from an OpenAI-compatible endpoint.
 * Yields content delta strings. Works with any ReadableStream.
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
