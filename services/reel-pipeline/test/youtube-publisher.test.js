import assert from 'node:assert/strict';
import { test } from 'node:test';
import { YouTubePublisher } from '../src/publishers/youtube.js';
import { YouTubePostingProvider } from '../src/posting.js';

function queuedFetch(responses) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error(`unexpected fetch call: ${url}`);
      return {
        ok: next.ok ?? true,
        status: next.status ?? 200,
        headers: { get: (name) => next.headers?.[name.toLowerCase()] ?? null },
        text: async () => next.body ?? '',
        json: async () => (typeof next.body === 'string' ? JSON.parse(next.body) : next.body ?? {}),
      };
    },
  };
}

function publisher(options = {}) {
  return new YouTubePublisher({
    clientId: 'cid',
    clientSecret: 'csecret',
    refreshToken: 'rtoken',
    readFileImpl: async () => Buffer.from('fake-mp4-bytes'),
    statImpl: async () => ({ size: 14 }),
    now: () => 1_000_000,
    ...options,
  });
}

test('accessToken exchanges refresh token and caches result', async () => {
  const { fetchImpl, calls } = queuedFetch([
    { body: { access_token: 'at-1', expires_in: 3600 } },
  ]);
  const pub = publisher({ fetchImpl });
  const first = await pub.accessToken();
  const second = await pub.accessToken();
  assert.equal(first, 'at-1');
  assert.equal(second, 'at-1');
  assert.equal(calls.length, 1);
  const form = new URLSearchParams(calls[0].init.body);
  assert.equal(form.get('grant_type'), 'refresh_token');
  assert.equal(form.get('refresh_token'), 'rtoken');
});

test('accessToken refreshes when near expiry', async () => {
  let now = 1_000_000;
  const { fetchImpl, calls } = queuedFetch([
    { body: { access_token: 'at-1', expires_in: 60 } },
    { body: { access_token: 'at-2', expires_in: 3600 } },
  ]);
  const pub = publisher({ fetchImpl, now: () => now });
  assert.equal(await pub.accessToken(), 'at-1');
  now += 30_000;
  assert.equal(await pub.accessToken(), 'at-2');
  assert.equal(calls.length, 2);
});

test('accessToken requires all OAuth credentials', async () => {
  const pub = new YouTubePublisher({ fetchImpl: async () => ({ ok: true }) });
  await assert.rejects(pub.accessToken(), /clientId, clientSecret/);
});

test('upload runs OAuth, resumable init, then PUT bytes', async () => {
  const { fetchImpl, calls } = queuedFetch([
    { body: { access_token: 'at-1', expires_in: 3600 } },
    { headers: { location: 'https://upload.example.com/session-xyz' } },
    { body: { id: 'vid-123', status: { privacyStatus: 'private' } } },
  ]);
  const pub = publisher({ fetchImpl });
  const result = await pub.upload({
    videoPath: '/tmp/fake.mp4',
    title: 'Lesson 1',
    description: 'how to learn',
    tags: ['math', 'lesson'],
  });

  assert.equal(result.videoId, 'vid-123');
  assert.equal(result.url, 'https://youtube.com/shorts/vid-123');

  const initCall = calls[1];
  assert.match(initCall.url, /uploadType=resumable&part=snippet,status/);
  assert.equal(initCall.init.headers.authorization, 'Bearer at-1');
  assert.equal(initCall.init.headers['x-upload-content-length'], '14');
  const metadata = JSON.parse(initCall.init.body);
  assert.equal(metadata.snippet.title, 'Lesson 1');
  assert.deepEqual(metadata.snippet.tags, ['math', 'lesson']);
  assert.match(metadata.snippet.description, /#Shorts$/);
  assert.equal(metadata.status.privacyStatus, 'private');

  const putCall = calls[2];
  assert.equal(putCall.url, 'https://upload.example.com/session-xyz');
  assert.equal(putCall.init.method, 'PUT');
  assert.ok(Buffer.isBuffer(putCall.init.body));
});

test('upload with publishAt forces private and forwards ISO timestamp', async () => {
  const { fetchImpl, calls } = queuedFetch([
    { body: { access_token: 'at-1', expires_in: 3600 } },
    { headers: { location: 'https://upload.example.com/s' } },
    { body: { id: 'vid-9', status: { privacyStatus: 'private', publishAt: '2026-07-01T12:00:00.000Z' } } },
  ]);
  const pub = publisher({ fetchImpl, defaultPrivacy: 'public' });
  const result = await pub.upload({
    videoPath: '/tmp/fake.mp4',
    title: 'Scheduled',
    publishAt: '2026-07-01T12:00:00Z',
  });
  const metadata = JSON.parse(calls[1].init.body);
  assert.equal(metadata.status.privacyStatus, 'private');
  assert.equal(metadata.status.publishAt, '2026-07-01T12:00:00.000Z');
  assert.equal(result.publishAt, '2026-07-01T12:00:00.000Z');
});

test('upload surfaces non-2xx from resumable init', async () => {
  const { fetchImpl } = queuedFetch([
    { body: { access_token: 'at-1', expires_in: 3600 } },
    { ok: false, status: 403, body: 'quota exceeded' },
  ]);
  const pub = publisher({ fetchImpl });
  await assert.rejects(
    pub.upload({ videoPath: '/tmp/fake.mp4', title: 't' }),
    /resumable init failed 403/,
  );
});

test('videoAnalytics fetches video statistics and normalizes metrics', async () => {
  const { fetchImpl, calls } = queuedFetch([
    { body: { access_token: 'at-1', expires_in: 3600 } },
    {
      body: {
        items: [
          {
            id: 'vid-123',
            statistics: {
              viewCount: '1200',
              likeCount: '34',
              commentCount: '5',
            },
          },
        ],
      },
    },
  ]);
  const pub = publisher({ fetchImpl, videosUrl: 'https://youtube.example.test/videos' });
  const result = await pub.videoAnalytics('vid-123');

  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /^https:\/\/youtube\.example\.test\/videos\?/);
  assert.match(calls[1].url, /part=statistics/);
  assert.match(calls[1].url, /id=vid-123/);
  assert.equal(calls[1].init.headers.authorization, 'Bearer at-1');
  assert.deepEqual(result.metrics, { views: 1200, likes: 34, comments: 5 });
});

test('YouTubePostingProvider rejects non-youtube_shorts channels', async () => {
  const provider = new YouTubePostingProvider({ publisher: { upload: async () => ({}) } });
  await assert.rejects(
    provider.post({ id: 'p1', channel: 'tiktok' }),
    /only handles youtube_shorts/,
  );
});

test('YouTubePostingProvider maps marketing post → upload args → result shape', async () => {
  const uploads = [];
  const stubPublisher = {
    upload: async (args) => {
      uploads.push(args);
      return { videoId: 'vid-7', url: 'https://youtube.com/shorts/vid-7', publishAt: null, raw: { id: 'vid-7' } };
    },
  };
  const provider = new YouTubePostingProvider({ publisher: stubPublisher });
  const post = {
    id: 'p1',
    channel: 'youtube_shorts',
    title: 'Hook',
    hook: 'Quick algebra trick',
    cta: 'Follow for more',
    local_path: '/tmp/render.mp4',
    tags: ['algebra'],
  };
  const result = await provider.post(post);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].videoPath, '/tmp/render.mp4');
  assert.equal(uploads[0].title, 'Hook');
  assert.match(uploads[0].description, /Quick algebra trick/);
  assert.equal(result.provider, 'youtube');
  assert.equal(result.status, 'posted');
  assert.equal(result.externalId, 'vid-7');
  assert.equal(result.externalUrl, 'https://youtube.com/shorts/vid-7');
});

test('YouTubePostingProvider with accounts config routes by project_slug', async () => {
  const seen = [];
  const provider = new YouTubePostingProvider({
    accounts: {
      tutoring: { slug: 'tutoring', clientId: 't', clientSecret: 't', refreshToken: 't', projects: ['p1'], default: true },
      brand: { slug: 'brand', clientId: 'b', clientSecret: 'b', refreshToken: 'b', projects: ['p2'] },
    },
    publisherFactory: (account) => ({
      upload: async () => {
        seen.push(account.slug);
        return { videoId: 'v', url: 'https://youtube.com/shorts/v', publishAt: null, raw: {} };
      },
    }),
  });
  await provider.post({ id: 'p1', channel: 'youtube_shorts', project_slug: 'p2', local_path: '/x.mp4' });
  await provider.post({ id: 'p2', channel: 'youtube_shorts', project_slug: 'p1', local_path: '/x.mp4' });
  assert.deepEqual(seen, ['brand', 'tutoring']);
});

test('YouTubePostingProvider requires either publisher or accounts', () => {
  assert.throws(() => new YouTubePostingProvider({}), /requires `accounts`/);
});

test('YouTubePostingProvider marks scheduled status when publishAt returned', async () => {
  const stubPublisher = {
    upload: async () => ({
      videoId: 'vid-8',
      url: 'https://youtube.com/shorts/vid-8',
      publishAt: '2026-07-01T12:00:00.000Z',
      raw: {},
    }),
  };
  const provider = new YouTubePostingProvider({ publisher: stubPublisher });
  const result = await provider.post({
    id: 'p2',
    channel: 'youtube_shorts',
    title: 't',
    local_path: '/tmp/x.mp4',
    scheduled_for: '2026-07-01T12:00:00Z',
  });
  assert.equal(result.status, 'scheduled');
  assert.equal(result.scheduledFor, '2026-07-01T12:00:00.000Z');
  assert.equal(result.postedAt, null);
});
