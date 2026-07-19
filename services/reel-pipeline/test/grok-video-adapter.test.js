import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { GrokVideoAdapter, selectGrokVideoAsset } from '../src/adapters/grok-video.js';
import { createDraftVideo, createRenderer } from '../src/pipeline.js';
import { normalizeVideoBrief } from '../src/video-brief.js';

const reelBody = [
  'Script: open with the big science claim.',
  'Shot list: space scale, atom closeup, concept recap.',
  'Captions: "space is not empty" and "atoms are mostly motion".',
  'Asset prompts: Grok Imagine science video with cosmic motion.',
].join('\n');

test('grok-video renderer mode maps to GrokVideoAdapter', () => {
  assert.equal(createRenderer('grok-video').constructor.name, 'GrokVideoAdapter');
  assert.equal(createRenderer('grok').constructor.name, 'GrokVideoAdapter');
  assert.equal(createRenderer('grok-videos').constructor.name, 'GrokVideoAdapter');
});

test('video brief accepts grok-video render mode', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-grok',
    projectSlug: 'science',
    channel: 'youtube_shorts',
    title: 'Cosmic scale',
    hook: 'Space is bigger than your intuition.',
    body: reelBody,
    renderMode: 'grok-video',
  });

  assert.equal(brief.renderMode, 'grok-video');
});

test('GrokVideoAdapter smoke proves request to status to artifact metadata', async () => {
  const root = path.resolve('./tmp/grok-video-test');
  const assetDir = path.join(root, 'assets');
  const artifactDir = path.join(root, 'artifacts');
  await rm(root, { recursive: true, force: true });
  await mkdir(assetDir, { recursive: true });
  await writeFile(path.join(assetDir, 'space-grok-imagine.mp4'), Buffer.from('fake space mp4'));
  await writeFile(path.join(assetDir, 'atom-grok-imagine.mp4'), Buffer.from('fake atom mp4'));

  const adapter = new GrokVideoAdapter({
    assetDir,
    artifactDir,
    now: () => new Date('2026-07-02T00:00:00.000Z'),
  });
  const brief = normalizeVideoBrief({
    id: 'brief-space',
    projectSlug: 'science',
    channel: 'tiktok',
    title: 'Cosmic scale',
    hook: 'Space is bigger than your intuition.',
    body: reelBody,
    renderMode: 'grok-video',
  });

  const render = await adapter.createVideo(brief);
  assert.equal(render.provider, 'grok-video');
  assert.equal(render.status, 'completed');
  assert.match(render.externalTaskId, /^grok_brief-space_/);
  assert.equal(render.videos.length, 1);
  assert.match(render.videos[0], /science-brief-space\.mp4$/);
  assert.ok(render.renderLog.some((line) => line.includes('space-grok-imagine.mp4')));

  const status = await adapter.getStatus(render.externalTaskId);
  assert.equal(status.provider, 'grok-video');
  assert.deepEqual(status.videos, render.videos);
});

test('selectGrokVideoAsset can use scene hints for insertion clips', async () => {
  const root = path.resolve('./tmp/grok-video-selector-test');
  const assetDir = path.join(root, 'assets');
  await rm(root, { recursive: true, force: true });
  await mkdir(assetDir, { recursive: true });
  await writeFile(path.join(assetDir, 'space-variant-1-grok-imagine.mp4'), Buffer.from('fake space mp4'));
  await writeFile(path.join(assetDir, 'atom-grok-imagine.mp4'), Buffer.from('fake atom mp4'));

  const selected = await selectGrokVideoAsset({
    id: 'brief-space',
    projectSlug: 'science',
    title: 'Scale lesson',
    hook: 'A quick lesson.',
    body: reelBody,
  }, {
    assetDir,
    sceneHints: ['cosmic scale', 'space motion', 'orbit'],
  });

  assert.equal(path.basename(selected.path), 'space-variant-1-grok-imagine.mp4');
  assert.ok(selected.score > 0);
});

test('createDraftVideo can publish a grok-video render result', async () => {
  const root = path.resolve('./tmp/grok-video-draft-test');
  const assetDir = path.join(root, 'assets');
  const artifactDir = path.join(root, 'artifacts');
  const publicDir = path.join(root, 'public');
  await rm(root, { recursive: true, force: true });
  await mkdir(assetDir, { recursive: true });
  await writeFile(path.join(assetDir, 'molecules-grok-imagine.mp4'), Buffer.from('fake molecules mp4'));

  const job = await createDraftVideo({
    id: 'brief-molecules',
    projectSlug: 'science',
    channel: 'instagram_reels',
    title: 'Molecules in motion',
    hook: 'Molecules are always moving.',
    body: reelBody,
    renderMode: 'grok-video',
  }, {
    grokVideo: { assetDir, artifactDir, now: () => new Date('2026-07-02T00:00:00.000Z') },
    artifacts: {
      baseUrl: 'https://assets.example.test/reels',
      publicDir,
    },
  });

  assert.equal(job.status, 'video_ready');
  assert.equal(job.render.provider, 'grok-video');
  assert.equal(job.render.videos[0], 'https://assets.example.test/reels/grok_brief-molecules_1782950400000-science-brief-molecules.mp4');
});
