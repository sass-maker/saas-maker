import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { ErrorState } from '@saas-maker/ui/components/error-state';
import type { BoundaryResource } from '@saas-maker/ui/blocks/resource-boundary';
import { createCockpitResources } from '../../apps/cockpit/src/components/cockpit-resources';
import { ResourceView } from '../../apps/cockpit/src/components/resource-view';
import {
  FeedbackTableSkeleton,
  SubscribersTableSkeleton,
} from '../../apps/cockpit/src/components/table-skeleton';
import { apiFetchClient } from '../../apps/cockpit/src/lib/api-client';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const empty = createElement(EmptyState, { title: 'no subscribers yet' });
const retry = vi.fn(async () => {});
function render(resource: BoundaryResource<string[]>) {
  return renderToStaticMarkup(
    createElement(ResourceView<string[]>, {
      resource,
      skeleton: createElement(SubscribersTableSkeleton),
      empty,
      children: (items) =>
        createElement(
          'ul',
          null,
          items.map((item) => createElement('li', { key: item }, item))
        ),
    })
  );
}

describe('cockpit loading and failure states', () => {
  it('offers the offline variant with a retry action', () => {
    const html = renderToStaticMarkup(createElement(ErrorState, { offline: true, onRetry: retry }));
    expect(html).toContain('you&#x27;re offline');
    expect(html).toContain('try again');
  });
  it('renders a visible content-shaped placeholder in the first server HTML', () => {
    const html = render({
      status: 'loading',
      data: undefined,
      error: undefined,
      isRevalidating: false,
      retry,
    });
    expect(html).toContain('data-table-skeleton');
    expect(html).toContain('Email');
    expect(html).toContain('Consented');
    expect(html).not.toContain('visibility:hidden');
    expect(html).not.toContain('no subscribers yet');
  });

  it('renders errors with retry separately from a successful empty response', () => {
    const failed = render({
      status: 'error',
      data: undefined,
      error: new Error('failed'),
      isRevalidating: false,
      retry,
    });
    expect(failed).toContain('data-slot="error-state"');
    expect(failed).toContain('try again');
    expect(failed).not.toContain('no subscribers yet');
    const successful = render({
      status: 'empty',
      data: [],
      error: undefined,
      isRevalidating: false,
      retry,
    });
    expect(successful).toContain('no subscribers yet');
    expect(successful).not.toContain('data-slot="error-state"');
  });

  it('keeps cached rows visible during revalidation and after a failed update', () => {
    const refreshing = render({
      status: 'success',
      data: ['cached subscriber'],
      error: undefined,
      isRevalidating: true,
      retry,
    });
    expect(refreshing).toContain('cached subscriber');
    expect(refreshing).not.toContain('data-table-skeleton');
    const failed = render({
      status: 'error',
      data: ['cached subscriber'],
      error: new Error('failed'),
      isRevalidating: false,
      retry,
    });
    expect(failed).toContain('cached subscriber');
    expect(failed).toContain('try again');
  });

  it('uses five rows and the same responsive columns as the feedback and subscriber tables', () => {
    for (const Skeleton of [FeedbackTableSkeleton, SubscribersTableSkeleton]) {
      const html = renderToStaticMarkup(createElement(Skeleton));
      expect(html.match(/<tbody\b[^>]*>[\s\S]*<\/tbody>/)?.[0].match(/<tr\b/g)).toHaveLength(5);
      expect(html).toContain('table-fixed');
      expect(html).toContain('sm:[&amp;_th:nth-child(3)]:table-cell');
      expect(html).toContain('md:[&amp;_th:nth-child(5)]:table-cell');
    }
  });
});

describe('cockpit resource cache', () => {
  it('seeds the shared key with the server timestamp and preserves newer cached data', () => {
    const resources = createCockpitResources();
    const path = '/v1/projects';
    const initialData = { data: [{ id: 'server-project' }] };
    resources.seed(path, { initialData, initialDataUpdatedAt: 1000 });
    expect(resources.client.entry(path).snapshot).toMatchObject({
      data: initialData,
      updated: 1000,
      error: undefined,
    });
    resources.client.mutate(path, { data: [{ id: 'client-project' }] });
    resources.seed(path, { initialData, initialDataUpdatedAt: 1000 });
    expect(resources.client.entry(path).snapshot.data).toEqual({
      data: [{ id: 'client-project' }],
    });
    resources.seed('/v1/projects/by-slug/unavailable', {});
    expect(
      resources.client.entry('/v1/projects/by-slug/unavailable').snapshot.data
    ).toBeUndefined();
  });

  it('retains the server seed after failed revalidation and updates it on retry', async () => {
    const resources = createCockpitResources();
    const path = '/v1/projects/by-slug/example';
    const initialData = { id: 'server-project' };
    resources.seed(path, { initialData, initialDataUpdatedAt: 1000 });
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('failed'), { status: 503 }));
    await resources.client.run(path, fetcher, { retries: 0, cacheTime: Infinity });
    expect(resources.client.entry(path).snapshot).toMatchObject({
      data: initialData,
      error: { status: 503 },
      updated: 1000,
    });
    fetcher.mockResolvedValue({ id: 'updated-project' });
    await resources.client.run(path, fetcher, { cacheTime: Infinity });
    expect(resources.client.entry(path).snapshot.data).toEqual({ id: 'updated-project' });
    expect(resources.client.entry(path).snapshot.error).toBeUndefined();
  });

  it('deduplicates requests and retains data when the last subscriber leaves', async () => {
    vi.useFakeTimers();
    const resources = createCockpitResources();
    const path = '/v1/projects';
    const off = resources.client.subscribe(path, () => {});
    const fetcher = vi.fn(async () => ({ data: [{ id: 'project' }] }));
    await Promise.all([resources.client.run(path, fetcher), resources.client.run(path, fetcher)]);
    off();
    const cached = resources.client.entry(path).snapshot.data;
    expect(cached).toEqual({ data: [{ id: 'project' }] });
    expect(fetcher).toHaveBeenCalledOnce();
    const revisit = resources.client.subscribe(path, () => {});
    expect(resources.client.entry(path).snapshot.data).toBe(cached);
    revisit();
  });

  it('isolates accounts and invalidates every cached feedback filter after mutations', () => {
    const account = createCockpitResources();
    const otherAccount = createCockpitResources();
    const paths = ['/v1/feedback?type=bug', '/v1/feedback?project=one&status=new'];
    for (const path of paths) {
      account.paths.add(path);
      account.client.mutate(path, { data: [{ id: 'feedback' }] });
    }
    account.invalidate('/v1/feedback?');
    for (const path of paths) {
      expect(account.client.entry(path).snapshot.updated).toBe(0);
      expect(account.client.entry(path).snapshot.data).toEqual({ data: [{ id: 'feedback' }] });
      expect(otherAccount.client.entry(path).snapshot.data).toBeUndefined();
    }
  });

  it('skips automatic 4xx retries and manually retries the same subscriber filter', async () => {
    vi.useFakeTimers();
    const resources = createCockpitResources();
    const path = '/v1/subscriptions?project=one&kind=waitlist';
    const fetch = vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 }));
    vi.stubGlobal('fetch', fetch);
    const fetcher = (signal: AbortSignal) => apiFetchClient(path, 'test-session', { signal });
    await resources.client.run(path, fetcher);
    expect(fetch).toHaveBeenCalledOnce();
    expect(resources.client.entry(path).snapshot.error).toMatchObject({ status: 403 });
    fetch.mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    await resources.client.run(path, fetcher);
    expect(resources.client.entry(path).snapshot.error).toBeUndefined();
    expect(fetch.mock.calls.every(([url]) => String(url).endsWith(path))).toBe(true);
  });

  it.each([
    503,
    'network',
  ])('retries %s failures with backoff and eventually succeeds', async (failure) => {
    vi.useFakeTimers();
    const resources = createCockpitResources();
    const error =
      failure === 'network'
        ? new TypeError('Failed to fetch')
        : Object.assign(new Error('failed'), { status: failure });
    const fetcher = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ data: [] });
    const request = resources.client.run('/v1/projects', fetcher);
    await vi.advanceTimersByTimeAsync(1000);
    await request;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(resources.client.entry('/v1/projects').snapshot.error).toBeUndefined();
  });
});
