import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/worker/index.js';

function createR2Mock() {
  const objects = new Map();
  return {
    async put(key, value, options = {}) {
      objects.set(key, { value: String(value), contentType: options.httpMetadata?.contentType });
    },
    async get(key, options) {
      if (key === 'draft.mp4') {
        assert.deepEqual(options ?? undefined, options);
        return {
          body: 'mp4-body',
          size: 100,
          httpEtag: '"etag"',
          writeHttpMetadata: (headers) => headers.set('content-type', 'video/mp4'),
        };
      }
      if (!objects.has(key)) return null;
      const object = objects.get(key);
      return {
        body: object.value,
        httpEtag: '"json-etag"',
        writeHttpMetadata: (headers) => headers.set('content-type', object.contentType ?? 'application/json; charset=utf-8'),
        json: async () => JSON.parse(object.value),
      };
    },
    async list({ prefix }) {
      return {
        objects: Array.from(objects.keys())
          .filter((key) => key.startsWith(prefix))
          .map((key) => ({ key })),
      };
    },
  };
}

test('artifact worker health endpoint returns ok', async () => {
  const res = await worker.fetch(new Request('https://assets.example.test/health'), {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('artifact worker serves R2 objects with video cache headers', async () => {
  const env = {
    REEL_ARTIFACTS: {
      get: async (key) => {
        assert.equal(key, 'draft.mp4');
        return {
          body: 'mp4-body',
          httpEtag: '"etag"',
          writeHttpMetadata: (headers) => headers.set('content-type', 'video/mp4'),
        };
      },
    },
  };

  const res = await worker.fetch(new Request('https://assets.example.test/reels/draft.mp4'), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(await res.text(), 'mp4-body');
});

test('worker creates reel drafts and serves swipe review UI', async () => {
  const env = { REEL_ARTIFACTS: createR2Mock() };
  const created = await worker.fetch(new Request('https://assets.example.test/reels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'worker-reel',
      projectSlug: 'reader',
      realDetails: 'Reader turns saved articles into review loops.',
      goal: 'Show readers their backlog can become a study loop',
      channel: 'instagram_reels',
    }),
  }), env);

  assert.equal(created.status, 201);
  const createdPayload = await created.json();
  assert.equal(createdPayload.data.id, 'worker-reel');
  assert.equal(createdPayload.data.status, 'generated');

  const listed = await worker.fetch(new Request('https://assets.example.test/reels?status=generated'), env);
  assert.equal(listed.status, 200);
  const listedPayload = await listed.json();
  assert.equal(listedPayload.data.length, 1);

  const page = await worker.fetch(new Request('https://assets.example.test/review'), env);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Swipe left to reject/);

  const decision = await worker.fetch(new Request('https://assets.example.test/reels/worker-reel/decision', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'reject' }),
  }), env);
  assert.equal(decision.status, 200);
  const decisionPayload = await decision.json();
  assert.equal(decisionPayload.data.status, 'rejected');
});

test('worker renders approved reel drafts into R2 mock artifacts', async () => {
  const env = { REEL_ARTIFACTS: createR2Mock() };
  await worker.fetch(new Request('https://assets.example.test/reels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'worker-render-reel',
      projectSlug: 'linkchat',
      realDetails: 'Profile answers repeated questions.',
      goal: 'Show creators a profile can answer first',
      channel: 'tiktok',
    }),
  }), env);
  await worker.fetch(new Request('https://assets.example.test/reels/worker-render-reel/decision', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'approve' }),
  }), env);

  const rendered = await worker.fetch(new Request('https://assets.example.test/reels/worker-render-reel/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'mock' }),
  }), env);
  assert.equal(rendered.status, 200);
  const payload = await rendered.json();
  assert.equal(payload.data.reel.status, 'video_ready');
  assert.match(payload.data.reel.assetUrl, /worker-render-reel-draft\.mp4$/);

  const artifact = await worker.fetch(new Request(payload.data.reel.assetUrl), env);
  assert.equal(artifact.status, 200);
  assert.equal(artifact.headers.get('content-type'), 'video/mp4');

  const ready = await worker.fetch(new Request('https://assets.example.test/reels/worker-render-reel/video-decision', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'approve' }),
  }), env);
  assert.equal(ready.status, 200);
  const readyPayload = await ready.json();
  assert.equal(readyPayload.data.status, 'ready_to_post');
});

test('worker ignores allowUnapproved in the public render body', async () => {
  const env = { REEL_ARTIFACTS: createR2Mock() };
  await worker.fetch(new Request('https://assets.example.test/reels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'worker-allow-unapproved',
      projectSlug: 'linkchat',
      realDetails: 'Public renders must still respect approval.',
      goal: 'Show creators a profile can answer first',
      channel: 'tiktok',
    }),
  }), env);

  const rendered = await worker.fetch(new Request('https://assets.example.test/reels/worker-allow-unapproved/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'mock', allowUnapproved: true }),
  }), env);
  assert.equal(rendered.status, 400);
  assert.match(await rendered.text(), /approved before rendering/);
});

test('worker derives artifact URLs from the current deployment origin', async () => {
  const env = { REEL_ARTIFACTS: createR2Mock() };
  await worker.fetch(new Request('https://preview.example.test/reels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'worker-origin',
      projectSlug: 'linkchat',
      realDetails: 'Artifact URLs should follow the current host.',
      goal: 'Show creators a profile can answer first',
      channel: 'tiktok',
    }),
  }), env);
  await worker.fetch(new Request('https://preview.example.test/reels/worker-origin/decision', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'approve' }),
  }), env);

  const rendered = await worker.fetch(new Request('https://preview.example.test/reels/worker-origin/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'mock' }),
  }), env);
  const payload = await rendered.json();
  assert.match(payload.data.reel.assetUrl, /^https:\/\/preview\.example\.test\/reels\/worker-origin-draft\.mp4$/);
});

test('artifact worker supports byte ranges for video playback', async () => {
  const env = {
    REEL_ARTIFACTS: {
      get: async (key, options) => {
        assert.equal(key, 'draft.mp4');
        assert.deepEqual(options, { range: { offset: 0, length: 4 } });
        return {
          body: 'mp4-',
          size: 100,
          httpEtag: '"etag"',
          writeHttpMetadata: (headers) => headers.set('content-type', 'video/mp4'),
        };
      },
    },
  };

  const res = await worker.fetch(new Request('https://assets.example.test/reels/draft.mp4', {
    headers: { range: 'bytes=0-3' },
  }), env);
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.equal(res.headers.get('content-range'), 'bytes 0-3/100');
  assert.equal(await res.text(), 'mp4-');
});

test('artifact worker supports open-ended byte ranges', async () => {
  const env = {
    REEL_ARTIFACTS: {
      get: async (key, options) => {
        assert.equal(key, 'draft.mp4');
        assert.deepEqual(options, { range: { offset: 10 } });
        return {
          body: 'tail',
          size: 100,
          httpEtag: '"etag"',
          writeHttpMetadata: (headers) => headers.set('content-type', 'video/mp4'),
        };
      },
    },
  };

  const res = await worker.fetch(new Request('https://assets.example.test/reels/draft.mp4', {
    headers: { range: 'bytes=10-' },
  }), env);
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 10-99/100');
});

test('artifact worker rejects unsafe artifact keys', async () => {
  const res = await worker.fetch(new Request('https://assets.example.test/reels/bad/key'), {
    REEL_ARTIFACTS: { get: async () => null },
  });
  assert.equal(res.status, 400);
});
