import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildDistributionRequest, executeDistribution } from '../src/distribution.js';
import { PostizContractFixtureAdapter, PostizFixtureError } from '../src/postiz-fixture-adapter.js';

const contentPackage = JSON.parse(await readFile(new URL('./fixtures/approved-content-package.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(await readFile(new URL('./fixtures/postiz-contract.json', import.meta.url), 'utf8'));
const mediaReceipt = { schema: 'fleet.media-receipt.v1', packageId: contentPackage.id, packageRevision: 1,
  variantId: 'vertical-proof-v1', brand: 'high-signal', channel: 'youtube_shorts', provider: 'brand-video-local',
  status: 'rendered', artifact: '/tmp/proof.mp4' };

function approvedRequest(options = {}) {
  const request = buildDistributionRequest(contentPackage, mediaReceipt, { provider: 'postiz', ...options });
  request.approval = { status: 'approved', approvedAt: '2026-07-12T12:15:00Z', approvedBy: 'fixture-owner' };
  return request;
}

test('Postiz evaluation is fixture-only and performs no network or account connection', async () => {
  assert.throws(() => new PostizContractFixtureAdapter({ ...fixture, mode: 'live' }), PostizFixtureError);
  const adapter = new PostizContractFixtureAdapter(fixture);
  const request = approvedRequest({ scheduledFor: '2026-07-13T12:00:00Z' });
  const receipt = await executeDistribution(contentPackage, mediaReceipt, request, { postizProvider: adapter, now: () => new Date('2026-07-12T12:16:00Z') });
  assert.equal(receipt.provider, 'postiz-fixture');
  assert.equal(receipt.status, 'scheduled');
  assert.deepEqual(adapter.calls[0].settings, { title: contentPackage.topic.title, privacyStatus: 'private' });
  assert.equal(adapter.calls[0].integrationId, 'fixture-high-signal-youtube');
});

test('fixture preserves brand/account isolation and fails closed for mismatches', async () => {
  const adapter = new PostizContractFixtureAdapter(fixture);
  await assert.rejects(() => adapter.post({ project_slug: 'significanthobbies', channel: 'youtube_shorts', account_slug: 'high-signal-youtube', local_path: '/tmp/proof.mp4' }), /no fixture integration/);
  const request = approvedRequest();
  request.accountSlug = 'significanthobbies-youtube';
  await assert.rejects(() => executeDistribution(contentPackage, mediaReceipt, request, { postizProvider: adapter }), /account mapping mismatch/);
});

test('channel-specific media rules and metrics normalize through the fixture contract', async () => {
  const adapter = new PostizContractFixtureAdapter(fixture);
  await assert.rejects(() => adapter.post({ project_slug: 'high-signal', channel: 'instagram_reels', account_slug: 'high-signal-instagram', body: 'caption' }), /public HTTPS/);
  const result = await adapter.post({ project_slug: 'high-signal', channel: 'instagram_reels', account_slug: 'high-signal-instagram',
    body: 'channel-specific caption', result_url: 'https://assets.example.test/proof.mp4' });
  assert.equal(result.externalId, 'fixture-instagram-release');
  assert.deepEqual(adapter.calls.at(-1).settings, { caption: 'channel-specific caption', shareToFeed: true });
  const metrics = await adapter.metrics(result.externalId);
  assert.deepEqual(metrics.metrics, { views: 85, likes: 11, comments: 1 });
});
