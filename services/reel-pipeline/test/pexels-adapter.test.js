import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PexelsClient, fetchScenebRoll, selectBestFile } from '../src/adapters/pexels.js';

function makePexelsFetch(responses) {
  const calls = [];
  let index = 0;
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const response = responses[index] ?? responses[responses.length - 1];
      index += 1;
      if (response.binary) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => response.binary.buffer.slice(response.binary.byteOffset, response.binary.byteOffset + response.binary.byteLength),
          text: async () => '',
        };
      }
      return {
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: async () => response.body,
        text: async () => JSON.stringify(response.body),
      };
    },
  };
}

function makeVideo({ id, duration = 10, files = [{ link: `https://files.example.com/${id}.mp4`, width: 1080, height: 1920, quality: 'hd', file_type: 'video/mp4' }] }) {
  return { id, duration, width: 1080, height: 1920, image: 'https://img', video_files: files, user: { name: 'Tester' } };
}

test('searchVideos sends bearer auth header and parses response', async () => {
  const { fetchImpl, calls } = makePexelsFetch([
    { body: { videos: [makeVideo({ id: 1 })] } },
  ]);
  const client = new PexelsClient({ apiKey: 'pex_key', fetchImpl });
  const videos = await client.searchVideos('coding laptop', { perPage: 5 });
  assert.equal(calls[0].init.headers.authorization, 'pex_key');
  assert.match(calls[0].url, /videos\/search\?query=coding\+laptop&orientation=portrait&size=medium&per_page=5/);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].files[0].url, 'https://files.example.com/1.mp4');
});

test('selectBestFile prefers portrait near 1280h', () => {
  const video = {
    files: [
      { width: 1920, height: 1080, fileType: 'video/mp4' },
      { width: 720, height: 1280, fileType: 'video/mp4' },
      { width: 1080, height: 1920, fileType: 'video/mp4' },
    ],
  };
  const best = selectBestFile(video);
  assert.equal(best.height, 1280);
});

test('fetchScenebRoll downloads one clip per scene and avoids reusing video ids', async () => {
  const { fetchImpl } = makePexelsFetch([
    { body: { videos: [makeVideo({ id: 1 }), makeVideo({ id: 2 })] } },
    { binary: Buffer.from('mp4-bytes-1') },
    { body: { videos: [makeVideo({ id: 1 }), makeVideo({ id: 3 })] } },
    { binary: Buffer.from('mp4-bytes-3') },
  ]);
  const client = new PexelsClient({ apiKey: 'k', fetchImpl });
  const dir = await mkdtemp(path.join(tmpdir(), 'pexels-broll-'));
  try {
    const scenes = [
      { label: 'hook', brollQuery: 'study desk', durationSeconds: 4 },
      { label: 'cta', brollQuery: 'student notebook', durationSeconds: 4 },
    ];
    const results = await fetchScenebRoll(scenes, { client, outputDir: dir });
    assert.equal(results.length, 2);
    assert.equal(results[0].videoId, 1);
    assert.equal(results[1].videoId, 3, 'should skip id=1 which was already used');
    assert.ok(results[0].path.endsWith('scene-01.mp4'));
    assert.ok(results[1].path.endsWith('scene-02.mp4'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('fetchScenebRoll records error when search yields nothing', async () => {
  const { fetchImpl } = makePexelsFetch([{ body: { videos: [] } }]);
  const client = new PexelsClient({ apiKey: 'k', fetchImpl });
  const dir = await mkdtemp(path.join(tmpdir(), 'pexels-empty-'));
  try {
    const scenes = [{ label: 'hook', brollQuery: 'rare topic', durationSeconds: 4 }];
    const results = await fetchScenebRoll(scenes, { client, outputDir: dir });
    assert.equal(results[0].path, null);
    assert.equal(results[0].error, 'no clip found');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
