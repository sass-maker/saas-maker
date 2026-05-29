import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import { createServer } from '../src/server/index.js';
import { FileReelStore } from '../src/file-reel-store.js';
import { normalizeVideoBrief } from '../src/video-brief.js';
import { ReelMakerAdapter, splitBriefIntoScenes } from '../src/adapters/reel-maker.js';
import { ProductProofCapture } from '../src/product-proof-capture.js';
import { renderReelVariants } from '../src/pipeline.js';

async function ensureFakeScreenshot(target) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from([137, 80, 78, 71]));
  return target;
}

const reelBody = [
  'Script: open the product, ask one question, see a real answer.',
  'Shot list: profile open, chat reply, end card.',
  'Captions: "stop manual answers" / "let the profile answer" / "send one link".',
  'Asset prompts: vertical phone UI, real product screenshot.',
].join('\n');

test('reel-maker adapter selects template and emits proof metadata', async () => {
  const commands = [];
  const adapter = new ReelMakerAdapter({
    engineDir: path.resolve('./tmp/reel-maker-variant-engine'),
    skipRemotionRender: true,
    productProofCapture: new ProductProofCapture({
      outputDir: path.resolve('./tmp/variant-proof'),
      commandRunner: async () => ({ stdout: '', stderr: '' }),
      screenshotFinder: async () => null,
    }),
    commandRunner: async (command, args, options) => {
      commands.push({ command, args, options });
      if (command === 'ffprobe') return { stdout: '2.0\n', stderr: '' };
      return { stdout: '', stderr: '' };
    },
  });
  const brief = normalizeVideoBrief({
    id: 'variant-brief',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'Variant brief',
    hook: 'Stop manual answers.',
    body: reelBody,
    cta: 'Ask one question.',
    productUrl: 'https://linkchat.example/',
    renderMode: 'remotion',
  });
  const result = await adapter.createVideo(brief, { variantId: 'v1' });
  assert.equal(result.template.id, 'problem_proof_cta');
  assert.equal(result.proofType, 'generated_card');
  assert.equal(result.variantId, 'v1');
  assert.ok(result.renderLog.some((entry) => entry.startsWith('template=')));
  const scenes = splitBriefIntoScenes(brief);
  assert.equal(scenes.length, 3);
});

test('renderReelVariants produces N variants with quality scores', async () => {
  const brief = normalizeVideoBrief({
    id: 'pipe-variant-brief',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'Pipeline variants',
    hook: 'Stop manual answers.',
    body: reelBody,
    cta: 'Ask one question.',
    productUrl: 'https://linkchat.example/',
    renderMode: 'remotion',
  });
  const adapter = new ReelMakerAdapter({
    engineDir: path.resolve('./tmp/reel-maker-pipeline-engine'),
    skipRemotionRender: true,
    productProofCapture: new ProductProofCapture({
      outputDir: path.resolve('./tmp/pipeline-variant-proof'),
      commandRunner: async () => ({ stdout: '', stderr: '' }),
      screenshotFinder: async () => null,
    }),
    commandRunner: async (command) => {
      if (command === 'ffprobe') return { stdout: '2.0\n', stderr: '' };
      return { stdout: '', stderr: '' };
    },
  });
  const { variants, renderLog } = await renderReelVariants(brief, {
    renderer: adapter,
    variantCount: 3,
  });
  assert.equal(variants.length, 3);
  assert.deepEqual(variants.map((variant) => variant.variantId).sort(), ['pipe-variant-brief-v1', 'pipe-variant-brief-v2', 'pipe-variant-brief-v3']);
  for (const variant of variants) {
    assert.ok(variant.qualityReasons.length >= 1);
    assert.ok(['video_ready', 'needs_review', 'video_rejected'].includes(variant.status));
    assert.ok(Number.isFinite(variant.qualityScore));
  }
  assert.ok(renderLog.length >= 3);
});

test('HTTP API renders variants and accepts a single variant', async () => {
  const storeDir = './tmp/server-variants-reels';
  await rm(storeDir, { recursive: true, force: true });
  const fakeScreenshot = await ensureFakeScreenshot(path.resolve('./tmp/server-variant-proof-source/linkchat.png'));
  const reelStore = new FileReelStore({ dir: storeDir });
  const server = createServer({
    reelStore,
    reelMaker: {
      engineDir: path.resolve('./tmp/reel-maker-server-engine'),
      skipRemotionRender: true,
      commandRunner: async (command) => {
        if (command === 'ffprobe') return { stdout: '2.0\n', stderr: '' };
        return { stdout: '', stderr: '' };
      },
    },
    productProofCapture: new ProductProofCapture({
      outputDir: path.resolve('./tmp/server-variant-proof'),
      commandRunner: async () => ({ stdout: '', stderr: '' }),
      screenshotFinder: async () => fakeScreenshot,
    }),
    artifacts: {
      baseUrl: 'https://assets.example.test/reels',
      publicDir: path.resolve('./tmp/server-variant-public'),
    },
  });
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const created = await fetch(`http://127.0.0.1:${port}/reels`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'variant-reel',
        projectSlug: 'linkchat',
        goal: 'Show profile answering DMs',
        productUrl: 'https://linkchat.example/',
        channel: 'tiktok',
        realDetails: 'Profile answers repeated DMs.',
      }),
    });
    assert.equal(created.status, 201);

    await fetch(`http://127.0.0.1:${port}/reels/variant-reel/decision`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve' }),
    });

    const rendered = await fetch(`http://127.0.0.1:${port}/reels/variant-reel/render`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'remotion', variantCount: 3 }),
    });
    assert.equal(rendered.status, 200);
    const renderedPayload = await rendered.json();
    const variants = renderedPayload.data.variants;
    assert.equal(variants.length, 3);
    assert.ok(variants.every((variant) => Number.isFinite(variant.qualityScore)));
    assert.ok(['video_ready', 'needs_review'].includes(renderedPayload.data.reel.status));

    const targetVariant = variants[0].variantId;
    const accepted = await fetch(`http://127.0.0.1:${port}/reels/variant-reel/video-decision`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: 'approve', variantId: targetVariant }),
    });
    assert.equal(accepted.status, 200);
    const acceptedPayload = await accepted.json();
    assert.equal(acceptedPayload.data.status, 'ready_to_post');
    const acceptedVariant = acceptedPayload.data.variants.find((variant) => variant.variantId === targetVariant);
    assert.equal(acceptedVariant.status, 'ready_to_post');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
