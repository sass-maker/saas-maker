import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  buildHtmlComposition,
  HtmlCompositionAdapter,
} from '../src/adapters/html-composition.js';
import { createDraftVideo, createRenderer } from '../src/pipeline.js';
import { normalizeVideoBrief } from '../src/video-brief.js';

const reelBody = [
  'Script: show how the operator sees a missed post before it becomes a launch gap.',
  'Shot list: summary card, queue filter, pending metrics row.',
  'Captions: "missed posts are visible" and "metrics sync has a queue".',
  'Asset prompts: HTML motion cards with product UI proof.',
].join('\n');

test('html composition render modes map to HtmlCompositionAdapter', () => {
  assert.equal(createRenderer('html').constructor.name, 'HtmlCompositionAdapter');
  assert.equal(createRenderer('html-composition').constructor.name, 'HtmlCompositionAdapter');
  assert.equal(createRenderer('web-composition').constructor.name, 'HtmlCompositionAdapter');
});

test('video brief accepts html composition render modes', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-html',
    projectSlug: 'reel-pipeline',
    channel: 'youtube_shorts',
    title: 'Ops preview',
    hook: 'A queue should show what needs action.',
    body: reelBody,
    renderMode: 'html-composition',
  });

  assert.equal(brief.renderMode, 'html-composition');
});

test('buildHtmlComposition emits timeline, preview HTML, and word cues', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-html',
    projectSlug: 'reel-pipeline',
    channel: 'instagram_reels',
    title: 'Ops preview',
    hook: 'A queue should show what needs action.',
    body: reelBody,
    renderMode: 'html',
    durationSeconds: 12,
  });

  const composition = buildHtmlComposition(brief);
  assert.equal(composition.timeline.format, 'html-composition-v1');
  assert.equal(composition.timeline.width, 1080);
  assert.equal(composition.timeline.height, 1920);
  assert.equal(composition.timeline.durationSeconds, 12);
  assert.ok(composition.timeline.scenes.length >= 3);
  assert.ok(composition.captions.length > 0);
  assert.ok(composition.captions[0].words.length > 0);
  assert.match(composition.html, /setCompositionTime/);
  assert.match(composition.html, /A queue should show/);
  assert.doesNotThrow(() =>
    JSON.parse(composition.html.match(/<script type="application\/json" id="captions">([^<]+)<\/script>/)?.[1] ?? '')
  );
});

test('HtmlCompositionAdapter smoke proves request to status to artifact metadata', async () => {
  const root = path.resolve('./tmp/html-composition-test');
  const artifactDir = path.join(root, 'artifacts');
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  const adapter = new HtmlCompositionAdapter({
    artifactDir,
    now: () => new Date('2026-07-03T00:00:00.000Z'),
  });
  const brief = normalizeVideoBrief({
    id: 'brief-html-preview',
    projectSlug: 'reel-pipeline',
    channel: 'tiktok',
    title: 'Ops preview',
    hook: 'Rendered posts need visible operating state.',
    body: reelBody,
    renderMode: 'html',
    durationSeconds: 10,
  });

  const render = await adapter.createVideo(brief);
  assert.equal(render.provider, 'html-composition');
  assert.equal(render.status, 'completed');
  assert.equal(render.externalTaskId, 'html_brief-html-preview_1783036800000');
  assert.deepEqual(render.videos, []);
  assert.equal(render.durationSeconds, 10);
  assert.ok(render.renderLog.includes('style=html-css-composition'));
  assert.match(render.raw.previewHtmlPath, /composition\.html$/);
  assert.match(render.raw.timelinePath, /timeline\.json$/);
  assert.match(render.raw.captionsPath, /captions\.json$/);

  const timeline = JSON.parse(await readFile(render.raw.timelinePath, 'utf8'));
  const captions = JSON.parse(await readFile(render.raw.captionsPath, 'utf8'));
  assert.equal(timeline.format, 'html-composition-v1');
  assert.ok(captions[0].words[0].start >= 0);

  const status = await adapter.getStatus(render.externalTaskId);
  assert.equal(status.provider, 'html-composition');
  assert.equal(status.raw.previewHtmlPath, render.raw.previewHtmlPath);
});

test('createDraftVideo can save an html composition preview job', async () => {
  const root = path.resolve('./tmp/html-composition-draft-test');
  const artifactDir = path.join(root, 'artifacts');
  await rm(root, { recursive: true, force: true });

  const job = await createDraftVideo(
    {
      id: 'brief-html-draft',
      projectSlug: 'reel-pipeline',
      channel: 'instagram_reels',
      title: 'HTML composition preview',
      hook: 'Video previews can be web pages first.',
      body: reelBody,
      renderMode: 'html',
    },
    {
      htmlComposition: {
        artifactDir,
        now: () => new Date('2026-07-03T00:00:00.000Z'),
      },
      storeOptions: {
        root,
      },
    }
  );

  assert.equal(job.status, 'video_ready');
  assert.equal(job.render.provider, 'html-composition');
  assert.deepEqual(job.render.videos, []);
  assert.match(job.render.raw.previewHtmlPath, /composition\.html$/);
});
