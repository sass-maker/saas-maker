import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildChatUrl, fetchChatCompletion, parseSSEStream } from '../chat';

describe('buildChatUrl', () => {
  it('appends /v1/chat/completions to bare URL', () => {
    expect(buildChatUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('appends /chat/completions to URL ending in /v1', () => {
    expect(buildChatUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('leaves URL ending in /chat/completions unchanged', () => {
    expect(buildChatUrl('https://api.openai.com/v1/chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
  });

  it('strips trailing slashes', () => {
    expect(buildChatUrl('https://api.openai.com/v1///')).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('trims whitespace', () => {
    expect(buildChatUrl('  https://api.openai.com  ')).toBe('https://api.openai.com/v1/chat/completions');
  });
});

describe('fetchChatCompletion', () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends request with correct URL, headers, and body', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));

    await fetchChatCompletion({
      config: { endpointUrl: 'https://api.openai.com/v1', apiKey: 'sk-123', model: 'gpt-4' },
      messages: [{ role: 'user', content: 'hi' }],
      systemPrompt: 'Be helpful',
      maxTokens: 100,
      stream: false,
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers['Authorization']).toBe('Bearer sk-123');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4');
    expect(body.stream).toBe(false);
    expect(body.max_tokens).toBe(100);
    expect(body.messages).toEqual([
      { role: 'system', content: 'Be helpful' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('omits system message when no systemPrompt', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));
    await fetchChatCompletion({
      config: { endpointUrl: 'https://x', apiKey: 'k', model: 'm' },
      messages: [{ role: 'user', content: 'hi' }],
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('merges custom headers', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));
    await fetchChatCompletion({
      config: { endpointUrl: 'https://x', apiKey: 'k', model: 'm' },
      messages: [{ role: 'user', content: 'hi' }],
      headers: { 'x-gateway-project-id': 'test' },
    });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['x-gateway-project-id']).toBe('test');
    expect(headers['Authorization']).toBe('Bearer k');
  });

  it('defaults maxTokens to 4096 and stream to true', async () => {
    mockFetch.mockResolvedValue(new Response('ok'));
    await fetchChatCompletion({
      config: { endpointUrl: 'https://x', apiKey: 'k', model: 'm' },
      messages: [{ role: 'user', content: 'hi' }],
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(4096);
    expect(body.stream).toBe(true);
  });
});

describe('parseSSEStream', () => {
  function makeResponse(chunks: string[]): Response {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    return new Response(stream);
  }

  it('yields content deltas from SSE chunks', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const response = makeResponse(chunks);
    const result: string[] = [];
    for await (const text of parseSSEStream(response)) result.push(text);
    expect(result).toEqual(['Hello', ' world']);
  });

  it('handles split chunks across buffer boundaries', async () => {
    const chunks = ['data: {"choices":[{"delta":{"con', 'tent":"split"}}]}\n\ndata: [DONE]\n\n'];
    const response = makeResponse(chunks);
    const result: string[] = [];
    for await (const text of parseSSEStream(response)) result.push(text);
    expect(result).toEqual(['split']);
  });

  it('ignores malformed JSON lines', async () => {
    const chunks = ['data: not json\n\ndata: {"choices":[{"delta":{"content":"ok"}}]}\n\n'];
    const response = makeResponse(chunks);
    const result: string[] = [];
    for await (const text of parseSSEStream(response)) result.push(text);
    expect(result).toEqual(['ok']);
  });

  it('yields nothing for empty response', async () => {
    const response = new Response('');
    const result: string[] = [];
    for await (const text of parseSSEStream(response)) result.push(text);
    expect(result).toEqual([]);
  });
});
