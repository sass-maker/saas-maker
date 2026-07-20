import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import type { DistributionRequest } from '../internal/contracts/distribution';
import { validateDistributionRequest } from '../internal/contracts/distribution';
import {
  FakePostizHarness,
  InMemoryPostizRateBudget,
  PostizClient,
  PostizError,
  redactPostizValue,
  translateDistributionRequest,
} from '../workers/api/src/adapters/postiz';
import type { PostizFetch, PostizMediaReference } from '../workers/api/src/adapters/postiz';

const distributionFixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/distribution-v1.json', 'utf8')
) as {
  instagramDraft: DistributionRequest;
  youtubeSchedule: DistributionRequest;
  media: PostizMediaReference[];
};
const fakeFixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/fake-postiz-v1.json', 'utf8')
) as unknown;

describe('provider-neutral distribution contracts and Postiz translation', () => {
  it('validates explicit content and distribution approval states', () => {
    expect(validateDistributionRequest(distributionFixture.instagramDraft)).toMatchObject({
      ok: true,
    });
    expect(validateDistributionRequest(distributionFixture.youtubeSchedule)).toMatchObject({
      ok: true,
    });

    const unapproved = structuredClone(distributionFixture.youtubeSchedule);
    unapproved.distribution_approval = {
      stage: 'distribution',
      status: 'pending',
      decided_by: null,
      decided_at: null,
      evidence_ref: null,
    };
    const result = validateDistributionRequest(unapproved);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain('distribution_approval must be approved for schedule or now');
    }
  });

  it('translates Instagram Reels to an inert draft payload', () => {
    expect(
      translateDistributionRequest(distributionFixture.instagramDraft, distributionFixture.media)
    ).toEqual({
      type: 'draft',
      date: '2026-07-20T09:00:00.000Z',
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: 'integration-instagram-001' },
          value: [
            {
              content: 'Show the evidence before the claim.',
              image: [
                {
                  id: 'postiz-upload-video-001',
                  path: 'https://postiz.invalid/uploads/video-001.mp4',
                },
              ],
            },
          ],
          settings: {
            __type: 'instagram',
            post_type: 'reel',
            is_trial_reel: false,
            collaborators: [],
          },
        },
      ],
    });
  });

  it('translates YouTube Shorts with schedule and visibility settings', () => {
    const payload = translateDistributionRequest(
      distributionFixture.youtubeSchedule,
      distributionFixture.media
    );
    expect(payload.type).toBe('schedule');
    expect(payload.date).toBe('2026-07-21T10:00:00.000Z');
    expect(payload.posts[0]?.settings).toEqual({
      __type: 'youtube',
      title: 'Proof-first launch in 30 seconds',
      type: 'public',
      selfDeclaredMadeForKids: 'no',
      thumbnail: null,
      tags: [
        { value: 'launch', label: 'launch' },
        { value: 'shorts', label: 'shorts' },
      ],
    });
  });
});

describe('server-only Postiz client', () => {
  it('uses the public API boundary for health, integrations, posts, status, and analytics', async () => {
    const fetch = vi.fn<PostizFetch>(async (input, init) => {
      const url = new URL(input);
      if (url.pathname.endsWith('/is-connected')) return json({ connected: true });
      if (url.pathname.endsWith('/integrations')) {
        return json([
          {
            id: 'integration-instagram-001',
            name: 'High Signal Instagram',
            identifier: 'instagram',
            disabled: false,
            profile: 'highsignal',
            accessToken: 'must-not-leave-adapter',
          },
        ]);
      }
      if (url.pathname.endsWith('/posts') && init.method === 'POST') {
        return json([{ postId: 'post-001', integration: 'integration-instagram-001' }]);
      }
      if (url.pathname.endsWith('/posts') && init.method === 'GET') {
        return json({
          posts: [
            {
              id: 'post-001',
              content: 'discarded upstream content',
              publishDate: '2026-07-21T10:00:00.000Z',
              releaseURL: null,
              integration: {
                id: 'integration-instagram-001',
                providerIdentifier: 'instagram',
                name: 'High Signal Instagram',
                picture: 'discarded',
              },
            },
          ],
        });
      }
      if (url.pathname.endsWith('/posts/post-001/status')) {
        return json({ id: 'post-001', state: 'QUEUE' });
      }
      if (url.pathname.includes('/analytics/')) {
        return json([
          {
            label: 'Views',
            data: [{ total: '120', date: '2026-07-20' }],
            percentageChange: 20,
            accountPayload: { token: 'discarded' },
          },
        ]);
      }
      return new Response('not found', { status: 404 });
    });
    const client = clientWith(fetch);
    const payload = translateDistributionRequest(
      distributionFixture.instagramDraft,
      distributionFixture.media
    );

    await expect(client.health()).resolves.toEqual({ connected: true });
    await expect(client.listIntegrations()).resolves.toEqual([
      {
        id: 'integration-instagram-001',
        name: 'High Signal Instagram',
        identifier: 'instagram',
        disabled: false,
        profile: 'highsignal',
      },
    ]);
    await expect(client.createPost(payload)).resolves.toEqual([
      { postId: 'post-001', integration: 'integration-instagram-001' },
    ]);
    await expect(
      client.listPosts({
        startDate: '2026-07-20T00:00:00.000Z',
        endDate: '2026-07-22T00:00:00.000Z',
      })
    ).resolves.toHaveLength(1);
    await expect(client.changePostStatus('post-001', 'schedule')).resolves.toEqual({
      id: 'post-001',
      state: 'QUEUE',
    });
    await expect(client.getPostAnalytics('post-001', 30)).resolves.toHaveLength(1);
    await expect(
      client.getPlatformAnalytics('integration-instagram-001', 30)
    ).resolves.toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it('retries transient reads within a fixed bound but never retries authentication failures', async () => {
    const sleeps: number[] = [];
    const transientFetch = vi
      .fn<PostizFetch>()
      .mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }))
      .mockResolvedValueOnce(json({ connected: true }));
    const client = clientWith(transientFetch, {
      maxRetries: 2,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await expect(client.health()).resolves.toEqual({ connected: true });
    expect(transientFetch).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([10, 20]);

    const authFetch = vi
      .fn<PostizFetch>()
      .mockResolvedValue(new Response('authorization=test-api-key', { status: 401 }));
    await expect(clientWith(authFetch, { maxRetries: 2 }).health()).rejects.toMatchObject({
      category: 'authentication',
      retryable: false,
      attempts: 1,
    });
    expect(authFetch).toHaveBeenCalledTimes(1);
    await clientWith(authFetch, { maxRetries: 0 })
      .health()
      .catch((error: PostizError) => expect(error.message).not.toContain('test-api-key'));
  });

  it('classifies timeouts and never retries an ambiguous create failure', async () => {
    const hangingFetch = vi.fn<PostizFetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    await expect(
      clientWith(hangingFetch, { timeoutMs: 5, maxRetries: 0 }).health()
    ).rejects.toMatchObject({ category: 'network', code: 'POSTIZ_TIMEOUT', attempts: 1 });

    const ambiguousFetch = vi.fn<PostizFetch>().mockRejectedValue(new Error('socket closed'));
    await expect(
      clientWith(ambiguousFetch, { maxRetries: 2 }).createPost(
        translateDistributionRequest(distributionFixture.instagramDraft, distributionFixture.media)
      )
    ).rejects.toMatchObject({ category: 'network', attempts: 1 });
    expect(ambiguousFetch).toHaveBeenCalledTimes(1);

    const ambiguousResponse = vi
      .fn<PostizFetch>()
      .mockResolvedValue(new Response('provider unavailable', { status: 503 }));
    await expect(
      clientWith(ambiguousResponse, { maxRetries: 2 }).createPost(
        translateDistributionRequest(distributionFixture.instagramDraft, distributionFixture.media)
      )
    ).rejects.toMatchObject({ category: 'provider', status: 503, attempts: 1 });
    expect(ambiguousResponse).toHaveBeenCalledTimes(1);
  });

  it('rejects credentials embedded in the Postiz base URL', () => {
    expect(
      () =>
        new PostizClient({
          baseUrl: 'https://user:password@postiz.internal/api/public/v1',
          apiKey: 'test-api-key',
        })
    ).toThrow(/must not contain credentials/);
  });

  it('enforces an injectable instance create budget before making a request', async () => {
    const fetch = vi
      .fn<PostizFetch>()
      .mockResolvedValue(json([{ postId: 'post-001', integration: 'integration-instagram-001' }]));
    const client = clientWith(fetch, {
      rateBudget: new InMemoryPostizRateBudget(1, 60_000, () => 0),
    });
    const payload = translateDistributionRequest(
      distributionFixture.instagramDraft,
      distributionFixture.media
    );
    await client.createPost(payload);
    await expect(client.createPost(payload)).rejects.toMatchObject({
      category: 'throttling',
      code: 'POSTIZ_RATE_BUDGET_EXHAUSTED',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('redacts credential-shaped fields recursively', () => {
    expect(
      redactPostizValue({
        authorization: 'Bearer should-not-survive',
        nested: { api_key: 'also-hidden', url: 'https://example.invalid/?token=hidden' },
      })
    ).toEqual({
      authorization: '[REDACTED]',
      nested: { api_key: '[REDACTED]', url: 'https://example.invalid/?token=[REDACTED]' },
    });
  });
});

describe('inert fake Postiz harness', () => {
  it('proves draft, schedule, list, status, and analytics without credentials or external writes', async () => {
    const fake = new FakePostizHarness(fakeFixture);
    const draftPayload = translateDistributionRequest(
      distributionFixture.instagramDraft,
      distributionFixture.media
    );
    const schedulePayload = translateDistributionRequest(
      distributionFixture.youtubeSchedule,
      distributionFixture.media
    );

    const [draft] = await fake.createPost(draftPayload);
    const [scheduled] = await fake.createPost(schedulePayload);
    expect(draft?.postId).toBe('fake-post-2');
    expect(scheduled?.postId).toBe('fake-post-3');
    await expect(fake.changePostStatus(draft!.postId, 'schedule')).resolves.toEqual({
      id: 'fake-post-2',
      state: 'QUEUE',
    });
    await expect(
      fake.listPosts({
        startDate: '2026-07-20T00:00:00.000Z',
        endDate: '2026-07-22T00:00:00.000Z',
      })
    ).resolves.toHaveLength(3);
    await expect(fake.getPostAnalytics(scheduled!.postId, 30)).resolves.toEqual([
      {
        label: 'Views',
        data: [{ total: '120', date: '2026-07-20' }],
        percentageChange: 20,
      },
    ]);
    await expect(fake.getPlatformAnalytics('integration-instagram-001', 30)).resolves.toHaveLength(
      1
    );
    expect(fake.mode).toBe('inert');
    expect(fake.externalRequests).toBe(0);
  });
});

function clientWith(
  fetch: PostizFetch,
  options: Partial<ConstructorParameters<typeof PostizClient>[0]> = {}
): PostizClient {
  return new PostizClient({
    baseUrl: 'https://postiz.invalid/public/v1',
    apiKey: 'test-api-key',
    fetch,
    timeoutMs: 100,
    maxRetries: 0,
    retryBaseMs: 10,
    maxRetryDelayMs: 100,
    random: () => 0,
    sleep: async () => {},
    ...options,
  });
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
