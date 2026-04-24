import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchModels } from '../models';

describe('fetchModels', () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty array for empty URL', async () => {
    expect(await fetchModels('', 'key')).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('tries /models first and succeeds', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4' }, { id: 'gpt-3.5' }] }), { status: 200 }),
    );
    const result = await fetchModels('https://api.openai.com/v1', 'sk-1');
    expect(result).toEqual(['gpt-3.5', 'gpt-4']); // sorted
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');
  });

  it('falls back to /v1/models if /models fails', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'claude-3' }] }), { status: 200 }),
      );
    const result = await fetchModels('https://api.example.com', 'k');
    expect(result).toEqual(['claude-3']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe('https://api.example.com/v1/models');
  });

  it('returns empty array when both endpoints fail', async () => {
    mockFetch.mockResolvedValue(new Response('error', { status: 500 }));
    expect(await fetchModels('https://x', 'k')).toEqual([]);
  });

  it('sends Bearer auth header', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await fetchModels('https://api.openai.com/v1', 'sk-abc');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBe('Bearer sk-abc');
  });

  it('omits Authorization header when apiKey is empty', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await fetchModels('https://x', '');
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('filters out invalid model entries', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ id: 'valid' }, {}, { id: '' }, { id: 'also-valid' }, { id: null }] }),
        { status: 200 },
      ),
    );
    expect(await fetchModels('https://x', 'k')).toEqual(['also-valid', 'valid']);
  });

  it('normalizes trailing slashes', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await fetchModels('https://api.openai.com/v1///', 'k');
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');
  });

  it('returns empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await fetchModels('https://x', 'k')).toEqual([]);
  });
});
