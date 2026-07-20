import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';

import { normalizeVideoBrief } from '../src/video-brief.js';
import { ProductProofCapture } from '../src/product-proof-capture.js';
import { selectTemplate, listTemplates, buildVariantPlan, getTemplate, hookVariantsForBrief } from '../src/reel-templates.js';
import { scoreVariant, gateForScore } from '../src/reel-quality.js';

const reelBody = [
  'Script: pain, proof, payoff.',
  'Shot list: pain, product, payoff.',
  'Captions: "stop manual answers" / "let the profile answer" / "send one link".',
  'Asset prompts: vertical phone UI and product chat screen.',
].join('\n');

test('video brief accepts product proof fields', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-proof',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'Link in bio chat',
    hook: 'Stop answering the same DM.',
    body: reelBody,
    productUrl: 'https://linkchat.example/profile/sample',
    proofUrl: 'https://linkchat.example/proof.png',
    targetRoute: '/profile/demo',
    proofType: 'screenshot',
    template: 'problem_proof_cta',
    brandTone: 'plainspoken',
    screenshots: ['./fixtures/sample.png'],
    demoSteps: [
      { action: 'goto', route: '/profile/demo', caption: 'Open profile' },
      { action: 'click', selector: '#ask', caption: 'Ask question' },
    ],
  });
  assert.equal(brief.productUrl, 'https://linkchat.example/profile/sample');
  assert.equal(brief.proofType, 'screenshot');
  assert.equal(brief.demoSteps.length, 2);
  assert.equal(brief.demoSteps[0].action, 'goto');
  assert.equal(brief.template, 'problem_proof_cta');
});

test('video brief rejects unsupported proofType', () => {
  assert.throws(() => normalizeVideoBrief({
    id: 'brief-bad-proof',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'demo',
    hook: 'hook',
    body: reelBody,
    proofType: 'something_else',
  }), /unsupported proofType/);
});

test('selectTemplate picks problem_proof_cta when product url is supplied', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-select',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'sel',
    hook: 'hook',
    body: reelBody,
    productUrl: 'https://linkchat.example/',
  });
  assert.equal(selectTemplate(brief).id, 'problem_proof_cta');
});

test('selectTemplate respects explicit template override', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-select-override',
    projectSlug: 'reader',
    channel: 'tiktok',
    title: 'sel',
    hook: 'hook',
    body: reelBody,
    template: 'mini_demo',
    demoSteps: [
      { action: 'goto', route: '/', caption: 'open' },
      { action: 'click', selector: '#x', caption: 'click' },
    ],
  });
  assert.equal(selectTemplate(brief).id, 'mini_demo');
});

test('listTemplates exposes the five PRD templates', () => {
  const ids = listTemplates().map((template) => template.id);
  assert.deepEqual(ids.sort(), ['before_after', 'changelog_proof', 'mini_demo', 'problem_proof_cta', 'teardown_audit'].sort());
});

test('buildVariantPlan returns N variants with distinct hooks', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-variant',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'Link in bio chat',
    hook: 'Stop answering the same DM.',
    body: reelBody,
    productUrl: 'https://linkchat.example/',
  });
  const plan = buildVariantPlan(brief, { variantCount: 3 });
  assert.equal(plan.length, 3);
  const hooks = plan.map((entry) => entry.hook);
  assert.equal(new Set(hooks).size, 3);
  assert.equal(plan[0].template.id, 'problem_proof_cta');
});

test('hookVariantsForBrief generates unique copies', () => {
  const hooks = hookVariantsForBrief({ hook: 'Stop doing it manually.', projectSlug: 'linkchat', cta: 'Ask once.' }, 4);
  assert.equal(hooks.length, 4);
  assert.equal(new Set(hooks.map((entry) => entry.hook)).size, 4);
});

test('product proof capture falls back to generated cards without a browser', async () => {
  const tmpDir = path.resolve('./tmp/proof-fallback-test');
  await rm(tmpDir, { recursive: true, force: true });

  const commands = [];
  const capture = new ProductProofCapture({
    outputDir: tmpDir,
    commandRunner: async (command, args) => {
      commands.push({ command, args });
      return { stdout: '', stderr: '' };
    },
    screenshotFinder: async () => null,
  });
  const brief = normalizeVideoBrief({
    id: 'brief-no-browser',
    projectSlug: 'unknown-product',
    channel: 'tiktok',
    title: 'No browser',
    hook: 'No browser',
    body: reelBody,
  });
  const result = await capture.capture(brief);
  assert.equal(result.type, 'generated_card');
  assert.equal(result.paths.length, 3);
  assert.equal(commands.every((call) => call.command === 'ffmpeg'), true);
});

test('product proof capture can use Grok video assets before generated cards', async () => {
  const tmpDir = path.resolve('./tmp/proof-grok-test');
  const assetDir = path.join(tmpDir, 'grok-assets');
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(assetDir, { recursive: true });
  await writeFile(path.join(assetDir, 'space-grok-imagine.mp4'), Buffer.from('fake-video-bytes'));

  const previous = process.env.GROK_VIDEO_ASSET_DIR;
  process.env.GROK_VIDEO_ASSET_DIR = assetDir;
  try {
    const capture = new ProductProofCapture({
      outputDir: path.join(tmpDir, 'proof'),
      commandRunner: async () => ({ stdout: '', stderr: '' }),
      screenshotFinder: async () => null,
    });
    const brief = normalizeVideoBrief({
      id: 'brief-grok-proof',
      projectSlug: 'science',
      channel: 'tiktok',
      title: 'Cosmic scale',
      hook: 'Space is bigger than intuition.',
      body: reelBody,
    });
    const result = await capture.capture(brief);
    assert.equal(result.type, 'recording');
    assert.equal(result.proofType, 'recording');
    assert.equal(path.basename(result.paths[0]), 'grok-space-grok-imagine.mp4');
  } finally {
    if (previous === undefined) delete process.env.GROK_VIDEO_ASSET_DIR;
    else process.env.GROK_VIDEO_ASSET_DIR = previous;
  }
});

test('product proof capture uses live browser screenshot when available', async () => {
  const tmpDir = path.resolve('./tmp/proof-live-test');
  await rm(tmpDir, { recursive: true, force: true });
  const screenshotCalls = [];
  const browserFactory = async () => ({
    async newContext() {
      return {
        async newPage() {
          return {
            async goto(url) { this.url = url; },
            async screenshot(options) {
              screenshotCalls.push(options);
              await mkdir(path.dirname(options.path), { recursive: true });
              await writeFile(options.path, Buffer.from([137, 80, 78, 71]));
            },
          };
        },
        async close() {},
      };
    },
    async close() {},
  });
  const capture = new ProductProofCapture({
    outputDir: tmpDir,
    browserFactory,
    commandRunner: async () => ({ stdout: '', stderr: '' }),
    screenshotFinder: async () => null,
  });
  const brief = normalizeVideoBrief({
    id: 'brief-live',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'Live capture',
    hook: 'Live capture',
    body: reelBody,
    productUrl: 'https://linkchat.example/profile/demo',
  });
  const result = await capture.capture(brief);
  assert.equal(result.type, 'screenshot');
  assert.equal(result.proofType, 'screenshot');
  assert.equal(result.paths.length, 1);
  assert.equal(screenshotCalls.length, 1);
});

test('product proof capture records a demo flow when preferRecording is set', async () => {
  const tmpDir = path.resolve('./tmp/proof-record-test');
  await rm(tmpDir, { recursive: true, force: true });
  let recordedPath;
  const browserFactory = async () => ({
    async newContext({ recordVideo } = {}) {
      const dir = recordVideo?.dir;
      recordedPath = path.join(dir, 'recording.webm');
      await mkdir(dir, { recursive: true });
      await writeFile(recordedPath, Buffer.from('fake-video-bytes'));
      return {
        async newPage() {
          return {
            url: null,
            async goto(url) { this.url = url; },
            async click() {},
            async fill() {},
            keyboard: { async press() {} },
            async waitForTimeout() {},
          };
        },
        async close() {},
      };
    },
    async close() {},
  });
  const capture = new ProductProofCapture({
    outputDir: tmpDir,
    browserFactory,
    commandRunner: async () => ({ stdout: '', stderr: '' }),
    screenshotFinder: async () => null,
  });
  const brief = normalizeVideoBrief({
    id: 'brief-rec',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'rec',
    hook: 'rec',
    body: reelBody,
    productUrl: 'https://linkchat.example/',
    demoSteps: [
      { action: 'goto', route: '/', caption: 'open' },
      { action: 'click', selector: '#ask', caption: 'ask' },
    ],
  });
  const result = await capture.capture(brief, { preferRecording: true });
  assert.equal(result.type, 'recording');
  assert.equal(result.proofType, 'recording');
  assert.equal(result.paths[0], recordedPath);
});

test('quality score gates render output by proof strength and overall', () => {
  const brief = { hook: 'Stop answering the same DM.', cta: 'Ask once.', body: reelBody, projectSlug: 'linkchat' };
  const goodScore = scoreVariant({
    brief,
    variant: { hook: brief.hook, cta: brief.cta },
    proof: { proofType: 'screenshot', type: 'screenshot', paths: ['/tmp/proof.png'] },
    render: { status: 'completed', videos: ['https://assets.example.test/reels/clip.mp4'], aspect: '9:16', durationSeconds: 14 },
  });
  assert.equal(goodScore.status, 'video_ready');
  assert.ok(goodScore.overall >= 0.7);

  const badScore = scoreVariant({
    brief,
    variant: { hook: brief.hook, cta: brief.cta },
    proof: { proofType: 'generated_card', type: 'generated_card', paths: [] },
    render: { status: 'completed', videos: [], aspect: '4:3', durationSeconds: 4 },
  });
  assert.ok(['video_rejected', 'needs_review'].includes(badScore.status));
  assert.ok(badScore.reasons.some((reason) => /product proof|rainbow|abstract|aspect/i.test(reason)));
});

test('slideshow risk downgrades an otherwise-ready static deck to review', () => {
  const brief = { hook: 'Stop answering the same DM.', cta: 'Ask once.', body: reelBody, projectSlug: 'linkchat', proofUrl: 'https://linkchat.test/proof' };
  const score = scoreVariant({
    brief,
    variant: { hook: brief.hook, cta: brief.cta },
    template: getTemplate('problem_proof_cta'),
    proof: { proofType: 'screenshot', type: 'screenshot', paths: ['/tmp/proof.png'] },
    render: { status: 'completed', videos: ['https://assets.example.test/reels/clip.mp4'], aspect: '9:16', durationSeconds: 18 },
  });
  assert.ok(score.slideshowRisk >= 0.6);
  assert.equal(score.status, 'needs_review');
  assert.ok(score.reasons.some((reason) => /slideshow/i.test(reason)));
});

test('a recorded demo keeps low slideshow risk and stays video_ready', () => {
  const brief = { hook: 'Watch it answer the DM itself.', cta: 'Ask once.', body: reelBody, projectSlug: 'linkchat', proofUrl: 'https://linkchat.test/proof' };
  const score = scoreVariant({
    brief,
    variant: { hook: brief.hook, cta: brief.cta },
    template: getTemplate('mini_demo'),
    proof: { proofType: 'recording', type: 'recording', paths: ['/tmp/demo.mp4'] },
    render: { status: 'completed', videos: ['https://assets.example.test/reels/clip.mp4'], aspect: '9:16', durationSeconds: 14 },
  });
  assert.ok(score.slideshowRisk < 0.6);
  assert.equal(score.status, 'video_ready');
});

test('slideshow risk is null when no template is supplied', () => {
  const score = scoreVariant({
    brief: { hook: 'Stop answering the same DM.', cta: 'Ask once.', body: reelBody, proofUrl: 'https://linkchat.test/proof' },
    variant: { hook: 'Stop answering the same DM.', cta: 'Ask once.' },
    proof: { proofType: 'screenshot', type: 'screenshot', paths: ['/tmp/proof.png'] },
    render: { status: 'completed', videos: ['https://assets.example.test/reels/clip.mp4'], aspect: '9:16', durationSeconds: 14 },
  });
  assert.equal(score.slideshowRisk, null);
  assert.equal(score.status, 'video_ready');
});

test('gateForScore maps overall score to status', () => {
  assert.equal(gateForScore({ overall: 0.85, scores: { productProofStrength: 0.8 } }), 'video_ready');
  assert.equal(gateForScore({ overall: 0.6, scores: { productProofStrength: 0.4 } }), 'needs_review');
  assert.equal(gateForScore({ overall: 0.2, scores: { productProofStrength: 0.2 } }), 'video_rejected');
});

test('getTemplate looks up by id', () => {
  const template = getTemplate('mini_demo');
  assert.equal(template.id, 'mini_demo');
  assert.equal(getTemplate('not-real'), null);
});
