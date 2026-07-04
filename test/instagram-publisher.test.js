import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InstagramPublisher } from '../src/publishers/instagram.js';
import { InstagramPostingProvider } from '../src/posting.js';

function routedFetch(routes) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      const target = typeof url === 'string' ? url : url.toString();
      calls.push({ url: target, init });
      const matched = routes.find((r) => r.match(target, init));
      if (!matched) throw new Error(`unexpected fetch: ${target}`);
      const next = typeof matched.respond === 'function' ? matched.respond(target, init) : matched.respond;
      return {
        ok: next.ok ?? true,
        status: next.status ?? 200,
        text: async () => (typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {})),
        json: async () => next.body ?? {},
      };
    },
  };
}

function publisher(extra = {}) {
  return new InstagramPublisher({
    userId: '1784',
    longLivedToken: 'lltoken',
    pollIntervalMs: 1,
    pollTimeoutMs: 1_000,
    sleepImpl: async () => {},
    now: () => 1_000_000,
    ...extra,
  });
}

test('publishReel runs container create → poll FINISHED → media_publish', async () => {
  const { fetchImpl, calls } = routedFetch([
    {
      match: (url, init) => url.endsWith('/1784/media') && init?.method === 'POST',
      respond: { body: { id: 'container-1' } },
    },
    {
      match: (url) => url.includes('/container-1?fields=status_code'),
      respond: { body: { status_code: 'FINISHED' } },
    },
    {
      match: (url, init) => url.endsWith('/1784/media_publish') && init?.method === 'POST',
      respond: { body: { id: 'media-99' } },
    },
  ]);
  const pub = publisher({ fetchImpl });
  const result = await pub.publishReel({
    videoUrl: 'https://cdn.example.com/reel.mp4',
    caption: 'hello',
  });
  assert.equal(result.mediaId, 'media-99');
  assert.equal(result.url, 'https://www.instagram.com/reel/media-99/');
  assert.equal(calls.length, 3);
  const createBody = new URLSearchParams(calls[0].init.body);
  assert.equal(createBody.get('media_type'), 'REELS');
  assert.equal(createBody.get('video_url'), 'https://cdn.example.com/reel.mp4');
  assert.equal(createBody.get('caption'), 'hello');
  assert.equal(createBody.get('access_token'), 'lltoken');
});

test('publishReel polls until FINISHED, surfacing IN_PROGRESS along the way', async () => {
  let polls = 0;
  const { fetchImpl } = routedFetch([
    { match: (url) => url.endsWith('/1784/media'), respond: { body: { id: 'c2' } } },
    {
      match: (url) => url.includes('/c2?fields=status_code'),
      respond: () => ({ body: { status_code: ++polls < 2 ? 'IN_PROGRESS' : 'FINISHED' } }),
    },
    { match: (url) => url.endsWith('/1784/media_publish'), respond: { body: { id: 'm2' } } },
  ]);
  const pub = publisher({ fetchImpl });
  const result = await pub.publishReel({ videoUrl: 'https://x/y.mp4' });
  assert.equal(result.mediaId, 'm2');
  assert.equal(polls, 2);
});

test('publishReel rejects non-http(s) video URLs', async () => {
  const pub = publisher();
  await assert.rejects(
    pub.publishReel({ videoUrl: 'file:///tmp/x.mp4' }),
    /must be a public http\(s\) URL/,
  );
});

test('publishReel surfaces a non-FINISHED terminal status', async () => {
  const { fetchImpl } = routedFetch([
    { match: (url) => url.endsWith('/1784/media'), respond: { body: { id: 'c3' } } },
    { match: (url) => url.includes('/c3?fields=status_code'), respond: { body: { status_code: 'ERROR' } } },
  ]);
  const pub = publisher({ fetchImpl });
  await assert.rejects(
    pub.publishReel({ videoUrl: 'https://x/y.mp4' }),
    /ended in ERROR/,
  );
});

test('publishReel surfaces EXPIRED terminal status', async () => {
  const { fetchImpl } = routedFetch([
    { match: (url) => url.endsWith('/1784/media'), respond: { body: { id: 'c-exp' } } },
    { match: (url) => url.includes('/c-exp?fields=status_code'), respond: { body: { status_code: 'EXPIRED' } } },
  ]);
  const pub = publisher({ fetchImpl });
  await assert.rejects(
    pub.publishReel({ videoUrl: 'https://x/y.mp4' }),
    /ended in EXPIRED/,
  );
});

test('publishReel throws when poll deadline is exceeded', async () => {
  let now = 1_000_000;
  const { fetchImpl } = routedFetch([
    { match: (url) => url.endsWith('/1784/media'), respond: { body: { id: 'c-stall' } } },
    {
      match: (url) => url.includes('/c-stall?fields=status_code'),
      respond: () => {
        now += 600;
        return { body: { status_code: 'IN_PROGRESS' } };
      },
    },
  ]);
  const pub = publisher({
    fetchImpl,
    now: () => now,
    pollIntervalMs: 1,
    pollTimeoutMs: 500,
  });
  await assert.rejects(
    pub.publishReel({ videoUrl: 'https://x/y.mp4' }),
    /did not finish within 500ms/,
  );
});

test('publishReel requires userId and longLivedToken', async () => {
  await assert.rejects(
    new InstagramPublisher({ longLivedToken: 't' }).publishReel({ videoUrl: 'https://x/y.mp4' }),
    /requires userId/,
  );
  await assert.rejects(
    new InstagramPublisher({ userId: 'u' }).publishReel({ videoUrl: 'https://x/y.mp4' }),
    /requires longLivedToken/,
  );
});

test('publishReel forwards share_to_feed=false when explicitly disabled', async () => {
  const { fetchImpl, calls } = routedFetch([
    { match: (url) => url.endsWith('/1784/media'), respond: { body: { id: 'c-flag' } } },
    { match: (url) => url.includes('/c-flag?fields=status_code'), respond: { body: { status_code: 'FINISHED' } } },
    { match: (url) => url.endsWith('/1784/media_publish'), respond: { body: { id: 'm-flag' } } },
  ]);
  const pub = publisher({ fetchImpl });
  await pub.publishReel({ videoUrl: 'https://x/y.mp4', shareToFeed: false });
  const body = new URLSearchParams(calls[0].init.body);
  assert.equal(body.get('share_to_feed'), 'false');
});

test('refreshLongLivedToken returns a new token + TTL', async () => {
  const { fetchImpl, calls } = routedFetch([
    {
      match: (url) => url.includes('refresh_access_token') && url.includes('ig_refresh_token'),
      respond: { body: { access_token: 'new-token', expires_in: 60 * 86400 } },
    },
  ]);
  const pub = publisher({ fetchImpl });
  const result = await pub.refreshLongLivedToken();
  assert.equal(result.longLivedToken, 'new-token');
  assert.equal(result.expiresInSeconds, 60 * 86400);
  assert.equal(calls.length, 1);
});

test('mediaInsights fetches media insight metrics and normalizes values', async () => {
  const { fetchImpl, calls } = routedFetch([
    {
      match: (url) => url.includes('/media-99/insights') && url.includes('metric=views%2Clikes%2Ccomments'),
      respond: {
        body: {
          data: [
            { name: 'views', values: [{ value: 100 }] },
            { name: 'likes', values: [{ value: '12' }] },
            { name: 'comments', total_value: { value: 3 } },
          ],
        },
      },
    },
  ]);
  const pub = publisher({ fetchImpl });
  const result = await pub.mediaInsights('media-99', ['views', 'likes', 'comments']);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /access_token=lltoken/);
  assert.deepEqual(result.metrics, { views: 100, likes: 12, comments: 3 });
});

test('InstagramPostingProvider rejects non-instagram_reels channels', async () => {
  const provider = new InstagramPostingProvider({ publisher: { publishReel: async () => ({}) } });
  await assert.rejects(
    provider.post({ id: 'p1', channel: 'youtube_shorts' }),
    /only handles instagram_reels/,
  );
});

test('InstagramPostingProvider with single publisher passes video URL + caption', async () => {
  const calls = [];
  const stub = {
    publishReel: async (args) => {
      calls.push(args);
      return { mediaId: 'm1', url: 'https://www.instagram.com/reel/m1/', raw: { id: 'm1' } };
    },
  };
  const provider = new InstagramPostingProvider({ publisher: stub });
  const result = await provider.post({
    id: 'p1',
    channel: 'instagram_reels',
    title: 'Lesson 1',
    hook: 'Watch this',
    cta: 'Follow',
    result_url: 'https://cdn.example.com/r.mp4',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].videoUrl, 'https://cdn.example.com/r.mp4');
  assert.match(calls[0].caption, /Watch this/);
  assert.equal(result.provider, 'instagram');
  assert.equal(result.status, 'posted');
  assert.equal(result.externalId, 'm1');
  assert.equal(result.externalUrl, 'https://www.instagram.com/reel/m1/');
});

test('InstagramPostingProvider with accounts config routes by project_slug', async () => {
  const seen = [];
  const provider = new InstagramPostingProvider({
    accounts: {
      tutoring: { slug: 'tutoring', userId: 'u-t', longLivedToken: 't-token', projects: ['p1'], default: true },
      brand: { slug: 'brand', userId: 'u-b', longLivedToken: 'b-token', projects: ['p2'] },
    },
    publisherFactory: (account) => ({
      publishReel: async () => {
        seen.push(account.slug);
        return { mediaId: 'm', url: 'https://x/m', raw: {} };
      },
    }),
  });
  await provider.post({ id: 'p1', channel: 'instagram_reels', project_slug: 'p2', result_url: 'https://x/y.mp4' });
  await provider.post({ id: 'p2', channel: 'instagram_reels', project_slug: 'p1', result_url: 'https://x/y.mp4' });
  assert.deepEqual(seen, ['brand', 'tutoring']);
});

test('InstagramPostingProvider requires either publisher or accounts', () => {
  assert.throws(() => new InstagramPostingProvider({}), /requires `accounts`/);
});
