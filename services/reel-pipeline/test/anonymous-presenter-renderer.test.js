import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  PresenterValidationError,
  resolvePresenter,
  validatePresenterManifest,
} from '../src/anonymous-video/presenter-library.js';
import {
  composePresenterOverlay,
  renderPresenterLedReel,
} from '../src/anonymous-video/renderer.js';

const fixturePath = path.resolve('test/fixtures/presenters/presenter-fixture.bin');
const fixtureManifestPath = path.resolve('test/fixtures/presenters/manifest.fixture.json');
const fixtureSha = createHash('sha256').update(await readFile(fixturePath)).digest('hex');

function fixtureManifest(overrides = {}) {
  return {
    schema: 'reel-pipeline.presenter-pack.v1',
    packId: 'test-only-presenters',
    presenters: [{
      id: 'fixture-presenter',
      assetPath: 'presenter-fixture.bin',
      sha256: fixtureSha,
      mediaType: 'video/mp4',
      commercialLicenseRef: 'fixture://commercial-use-test-only',
      modelReleaseRef: 'fixture://model-release-test-only',
      allowedTransformations: ['scale', 'crop', 'overlay'],
      attribution: { required: false },
      productionApproved: false,
      ...overrides,
    }],
  };
}

test('presenter manifest requires checksum, commercial licence, release, and transformations', () => {
  assert.throws(
    () => validatePresenterManifest(fixtureManifest({ commercialLicenseRef: '' }), {
      manifestPath: fixtureManifestPath,
      allowTestOnly: true,
    }),
    /commercialLicenseRef is required/,
  );
  assert.throws(
    () => validatePresenterManifest(fixtureManifest({ modelReleaseRef: '' }), {
      manifestPath: fixtureManifestPath,
      allowTestOnly: true,
    }),
    /modelReleaseRef is required/,
  );
  assert.throws(
    () => validatePresenterManifest(fixtureManifest({ sha256: 'not-a-checksum' }), {
      manifestPath: fixtureManifestPath,
      allowTestOnly: true,
    }),
    /SHA-256/,
  );
});

test('synthetic human presenters require explicit fictional generation provenance, not a model release', () => {
  const validated = validatePresenterManifest(fixtureManifest({
    likenessType: 'synthetic-human',
    modelReleaseRef: undefined,
    syntheticProvenance: {
      generator: 'fixture-image-generator',
      generationRef: 'fixture://synthetic-presenter-1',
      createdAt: '2026-07-13T00:00:00Z',
      fictionalIdentity: true,
    },
  }), {
    manifestPath: fixtureManifestPath,
    allowTestOnly: true,
  });
  assert.equal(validated.presenters[0].likenessType, 'synthetic-human');
  assert.equal(validated.presenters[0].modelReleaseRef, null);
  assert.equal(validated.presenters[0].syntheticProvenance.fictionalIdentity, true);
  assert.throws(
    () => validatePresenterManifest(fixtureManifest({
      likenessType: 'synthetic-human',
      modelReleaseRef: undefined,
      syntheticProvenance: { fictionalIdentity: false },
    }), {
      manifestPath: fixtureManifestPath,
      allowTestOnly: true,
    }),
    /fictionalIdentity must be true/,
  );
});

test('production presenter pack resolves the checksum-pinned fictional synthetic presenter', async () => {
  const presenter = await resolvePresenter();
  assert.equal(presenter.id, 'synthetic-presenter-v1');
  assert.equal(presenter.likenessType, 'synthetic-human');
  assert.equal(presenter.syntheticProvenance.fictionalIdentity, true);
  assert.equal(presenter.modelReleaseRef, null);
});

test('presenter resolution fails closed before use on production approval or checksum mismatch', async () => {
  await assert.rejects(
    resolvePresenter({ manifest: fixtureManifest(), manifestPath: fixtureManifestPath }),
    (error) => error instanceof PresenterValidationError && error.code === 'presenter_not_production_approved',
  );
  await assert.rejects(
    resolvePresenter({
      manifest: fixtureManifest({ sha256: '0'.repeat(64) }),
      manifestPath: fixtureManifestPath,
      allowTestOnly: true,
    }),
    (error) => error instanceof PresenterValidationError && error.code === 'presenter_checksum_mismatch',
  );
});

test('FFmpeg composition scales to 9:16 and overlays the presenter continuously', async () => {
  const calls = [];
  const result = await composePresenterOverlay({
    sourceVideo: '/tmp/base.mp4',
    presenter: { assetPath: fixturePath, mediaType: 'video/mp4' },
    outputPath: '/tmp/output.mp4',
    creative: { cta: 'See the product' },
    runFfmpeg: async (args) => calls.push(args),
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0].join(' '), /scale=1080:1920/);
  assert.match(calls[0].join(' '), /force_original_aspect_ratio=increase/);
  assert.match(calls[0].join(' '), /scale=720:1100/);
  assert.match(calls[0].join(' '), /enable='lt\(t,4\)'/);
  assert.match(calls[0].join(' '), /overlay=W-w-48:H-h-170/);
  assert.match(calls[0].join(' '), /enable='gte\(t,4\)'/);
  assert.equal(result.aspect, '9:16');
  assert.equal(result.presenterPlacement, 'center-opening-then-lower-right');
  assert.equal(result.presenterProminentInOpening, true);
  assert.equal(result.presenterAppearsInLaterScene, true);
});

test('presenter-led renderer validates proof first and records complete provenance', async () => {
  let rendererCalls = 0;
  const result = await renderPresenterLedReel({
    brief: { id: 'brief-1', renderMode: 'mock' },
    website: {
      canonicalUrl: 'https://brand.example/',
      evidence: [{ sourceUrl: 'https://brand.example/', kind: 'claim', value: 'Evidence-backed claim' }],
    },
    assets: [{ url: 'https://brand.example/product.png', sourceUrl: 'https://brand.example/', kind: 'product' }],
    creative: {
      narration: 'Meet the product.',
      captions: ['Meet the product.'],
      onScreenText: ['A better workflow'],
      cta: 'Visit the website',
    },
    voice: { provider: 'fixture-tts', voiceId: 'voice-1', model: 'fixture-model' },
  }, {
    presenterManifest: fixtureManifest(),
    presenterManifestPath: fixtureManifestPath,
    allowTestOnlyPresenter: true,
    artifactDir: './tmp/anonymous-presenter-test',
    renderer: {
      async createVideo() {
        rendererCalls += 1;
        return { provider: 'fixture-renderer', externalTaskId: 'base-1', status: 'completed', videos: ['/tmp/base.mp4'], durationSeconds: 18 };
      },
    },
    compose: async ({ outputPath }) => ({ outputPath, width: 1080, height: 1920, durationSeconds: 18 }),
    review: async () => ({ ok: true, issues: [], probed: { aspect: '9:16', hasAudio: true } }),
  });
  assert.equal(rendererCalls, 1);
  assert.equal(result.status, 'completed');
  assert.equal(result.raw.presenterIncluded, true);
  assert.equal(result.provenance.website.canonicalUrl, 'https://brand.example/');
  assert.equal(result.provenance.presenter.sha256, fixtureSha);
  assert.equal(result.provenance.presenter.likenessType, 'real-human');
  assert.equal(result.provenance.voice.provider, 'fixture-tts');
  assert.equal(result.provenance.renderer.baseProvider, 'fixture-renderer');
  assert.equal(result.provenance.timing.width, 1080);
  assert.equal(result.provenance.review.ok, true);
});

test('missing production presenter blocks base rendering', async () => {
  let rendererCalls = 0;
  await assert.rejects(
    renderPresenterLedReel({
      brief: { id: 'brief-1', renderMode: 'mock' },
      website: { canonicalUrl: 'https://brand.example/' },
      creative: { narration: 'n', captions: ['c'], onScreenText: ['o'], cta: 'cta' },
    }, {
      presenterManifest: {
        schema: 'reel-pipeline.presenter-pack.v1',
        packId: 'empty',
        presenters: [],
        productionGate: 'approved presenter asset required',
      },
      presenterManifestPath: fixtureManifestPath,
      renderer: { async createVideo() { rendererCalls += 1; } },
    }),
    (error) => error instanceof PresenterValidationError && error.code === 'presenter_pack_empty',
  );
  assert.equal(rendererCalls, 0);
});

test('completed composition is not exposed when technical review is unavailable', async () => {
  await assert.rejects(
    renderPresenterLedReel({
      brief: { id: 'brief-1', renderMode: 'mock' },
      website: { canonicalUrl: 'https://brand.example/' },
      creative: { narration: 'n', captions: ['c'], onScreenText: ['o'], cta: 'cta' },
    }, {
      presenterManifest: fixtureManifest(),
      presenterManifestPath: fixtureManifestPath,
      allowTestOnlyPresenter: true,
      artifactDir: './tmp/anonymous-presenter-test',
      renderer: {
        async createVideo() {
          return { provider: 'fixture-renderer', externalTaskId: 'base-1', status: 'completed', videos: ['/tmp/base.mp4'] };
        },
      },
      compose: async ({ outputPath }) => ({ outputPath, width: 1080, height: 1920 }),
      review: async () => null,
    }),
    /technical review unavailable/,
  );
});
