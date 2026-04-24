import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIConfig } from '../hooks/useAIConfig';
import { useModelDiscovery } from '../hooks/useModelDiscovery';

describe('useAIConfig', () => {
  beforeEach(() => localStorage.clear());

  it('initializes with default empty config', () => {
    const { result } = renderHook(() => useAIConfig());
    expect(result.current.config).toEqual({ endpointUrl: '', apiKey: '', model: '' });
    expect(result.current.isReady).toBe(false);
  });

  it('loads existing config from localStorage', () => {
    localStorage.setItem(
      'ai-config',
      JSON.stringify({ endpointUrl: 'https://x', apiKey: 'k', model: 'm' }),
    );
    const { result } = renderHook(() => useAIConfig());
    expect(result.current.config).toEqual({ endpointUrl: 'https://x', apiKey: 'k', model: 'm' });
    expect(result.current.isReady).toBe(true);
  });

  it('uses custom storage key', () => {
    localStorage.setItem(
      'custom',
      JSON.stringify({ endpointUrl: 'url', apiKey: 'k', model: 'm' }),
    );
    const { result } = renderHook(() => useAIConfig('custom'));
    expect(result.current.config.endpointUrl).toBe('url');
  });

  it('update() applies partial config changes', () => {
    const { result } = renderHook(() => useAIConfig());
    act(() => result.current.update({ endpointUrl: 'https://new' }));
    expect(result.current.config.endpointUrl).toBe('https://new');
    expect(result.current.config.apiKey).toBe('');
  });

  it('save() persists to localStorage', () => {
    const { result } = renderHook(() => useAIConfig());
    act(() => result.current.update({ endpointUrl: 'https://x', apiKey: 'k' }));
    act(() => result.current.save());
    const stored = JSON.parse(localStorage.getItem('ai-config')!);
    expect(stored.endpointUrl).toBe('https://x');
    expect(stored.apiKey).toBe('k');
  });

  it('isReady is true when endpointUrl and apiKey are set', () => {
    const { result } = renderHook(() => useAIConfig());
    expect(result.current.isReady).toBe(false);
    act(() => result.current.update({ endpointUrl: 'https://x' }));
    expect(result.current.isReady).toBe(false);
    act(() => result.current.update({ apiKey: 'k' }));
    expect(result.current.isReady).toBe(true);
  });
});

describe('useModelDiscovery', () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useModelDiscovery());
    expect(result.current.models).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('discovers models via direct fetch when no modelsApiUrl', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'gpt-4' }] }), { status: 200 }),
    );
    const { result } = renderHook(() => useModelDiscovery());
    await act(async () => {
      await result.current.discover('https://x', 'k');
    });
    expect(result.current.models).toEqual(['gpt-4']);
    expect(result.current.loading).toBe(false);
    expect(mockFetch.mock.calls[0][0]).toBe('https://x/models');
  });

  it('discovers models via server proxy when modelsApiUrl provided', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ models: ['a', 'b'] }), { status: 200 }),
    );
    const { result } = renderHook(() => useModelDiscovery({ modelsApiUrl: '/api/models' }));
    await act(async () => {
      await result.current.discover('https://x', 'k');
    });
    expect(result.current.models).toEqual(['a', 'b']);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/models');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ endpointUrl: 'https://x', apiKey: 'k' });
  });

  it('sets error on server proxy failure', async () => {
    mockFetch.mockResolvedValueOnce(new Response('fail', { status: 500 }));
    const { result } = renderHook(() => useModelDiscovery({ modelsApiUrl: '/api/models' }));
    await act(async () => {
      await result.current.discover('https://x', 'k');
    });
    expect(result.current.error).toBe('Failed to fetch models');
    expect(result.current.models).toEqual([]);
  });

  it('skips discovery when endpointUrl is empty', async () => {
    const { result } = renderHook(() => useModelDiscovery());
    await act(async () => {
      await result.current.discover('', 'k');
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
