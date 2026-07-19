import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { approveEnvelopeDistribution, buildDistributionEnvelope, parseDistributionEnvelope, upsertDistributionEnvelope } from '../src/distribution-envelope.js';
import { enqueueContentPackages, renderApprovedContent, runScheduledDistributions, syncSourceContent, takePackagesWithinReviewCapacity } from '../src/marketing-orchestrator.js';
import { FilePublicationLedger } from '../src/publication-ledger.js';

const approvedFixture = JSON.parse(await readFile(new URL('./fixtures/approved-content-package.json', import.meta.url), 'utf8'));
const proposed = structuredClone(approvedFixture);
proposed.approval = { status: 'proposed', approvedAt: null, approvedBy: null };
proposed.variants[0].status = 'proposed';

function fakeClient() {
  const posts = [];
  return {
    posts,
    async listMarketingPosts(filters = {}) { return posts.filter((post) => !filters.status || post.status === filters.status); },
    async createMarketingPost(input) { const post = { id: `post-${posts.length + 1}`, ...input, asset_url: input.asset_url ?? null, result_url: input.result_url ?? null, scheduled_for: input.scheduled_for ?? null, posted_at: null }; posts.push(post); return post; },
    async updateMarketingPost(id, patch) { const post = posts.find((entry) => entry.id === id); Object.assign(post, patch); return { skipped: false, data: post }; },
  };
}

test('content package goes through queue approval, render, distribution approval, and one publication', async () => {
  const client = fakeClient();
  const notifications = [];
  const current = new Date('2026-07-12T12:00:00Z');
  const artifact = path.join(await mkdtemp(path.join(os.tmpdir(), 'marketing-artifact-')), 'proof.mp4');
  await writeFile(artifact, 'fixture');
  await enqueueContentPackages([proposed], { client });
  assert.equal(client.posts.length, 1);
  assert.equal(client.posts[0].status, 'generated');
  assert.equal(parseDistributionEnvelope(client.posts[0].notes).mediaReceipt, null);

  client.posts[0].status = 'accepted';
  await renderApprovedContent({
    client,
    now: () => current,
    renderer: async (contentPackage, options) => ({
      receipt: {
        schema: 'fleet.media-receipt.v1', packageId: contentPackage.id, packageRevision: contentPackage.revision,
        variantId: options.variantId, brand: contentPackage.brand.slug, channel: 'youtube_shorts',
        provider: 'brand-video-local', status: 'rendered', artifact,
      },
    }),
    publishArtifact: async (receipt) => ({ ...receipt, publicUrl: 'https://assets.example.test/proof.mp4' }),
    notifier: async (event) => notifications.push(event),
  });
  let envelope = parseDistributionEnvelope(client.posts[0].notes);
  assert.equal(envelope.contentPackage.approval.status, 'approved');
  assert.equal(envelope.mediaReceipt.publicUrl, 'https://assets.example.test/proof.mp4');
  assert.equal(envelope.distributionRequest.approval.status, 'proposed');

  envelope = approveEnvelopeDistribution(envelope, { approvedBy: 'owner', approvedAt: current, scheduledFor: current });
  client.posts[0].notes = upsertDistributionEnvelope(client.posts[0].notes, envelope);
  client.posts[0].scheduled_for = current.toISOString();
  const ledger = new FilePublicationLedger({ root: await mkdtemp(path.join(os.tmpdir(), 'publication-ledger-')), now: () => current });
  let postCalls = 0;
  const provider = { post: async () => { postCalls += 1; return { provider: 'youtube', status: 'posted', externalId: 'video-1', externalUrl: 'https://youtube.test/shorts/video-1', postedAt: current.toISOString() }; } };
  const first = await runScheduledDistributions({ client, ledger, now: () => current, providerFactory: async () => provider, notifier: async (event) => notifications.push(event) });
  const second = await runScheduledDistributions({ client, ledger, now: () => current, providerFactory: async () => provider, notifier: async (event) => notifications.push(event) });
  assert.equal(first.results[0].status, 'posted');
  assert.equal(postCalls, 1);
  assert.equal(client.posts[0].status, 'sent');
  assert.equal(parseDistributionEnvelope(client.posts[0].notes).publicationReceipt.externalId, 'video-1');
  assert.equal(second.scanned, 0);
  assert.equal(notifications.length, 2);
});

test('retryable publication failure records backoff and does not retry early', async () => {
  const client = fakeClient();
  await enqueueContentPackages([proposed], { client });
  client.posts[0].status = 'accepted';
  const current = new Date('2026-07-12T12:00:00Z');
  const artifact = path.join(await mkdtemp(path.join(os.tmpdir(), 'marketing-artifact-')), 'proof.mp4');
  await writeFile(artifact, 'fixture');
  await renderApprovedContent({
    client, now: () => current,
    renderer: async (contentPackage, options) => ({ receipt: { schema: 'fleet.media-receipt.v1', packageId: contentPackage.id, packageRevision: 1, variantId: options.variantId, brand: 'high-signal', channel: 'youtube_shorts', provider: 'brand-video-local', status: 'rendered', artifact } }),
    publishArtifact: async (receipt) => ({ ...receipt, publicUrl: 'https://assets.example.test/proof.mp4' }), notifier: async () => {},
  });
  let envelope = approveEnvelopeDistribution(parseDistributionEnvelope(client.posts[0].notes), { approvedBy: 'owner', approvedAt: current, scheduledFor: current });
  client.posts[0].notes = upsertDistributionEnvelope(client.posts[0].notes, envelope);
  const ledger = new FilePublicationLedger({ root: await mkdtemp(path.join(os.tmpdir(), 'publication-ledger-')), now: () => current });
  let calls = 0;
  const provider = { post: async () => { calls += 1; throw new Error('YouTube 503'); } };
  const first = await runScheduledDistributions({ client, ledger, now: () => current, providerFactory: async () => provider, notifier: async () => {} });
  const second = await runScheduledDistributions({ client, ledger, now: () => current, providerFactory: async () => provider, notifier: async () => {} });
  envelope = parseDistributionEnvelope(client.posts[0].notes);
  assert.equal(first.results[0].retryable, true);
  assert.equal(envelope.attempts.state, 'retry_wait');
  assert.equal(envelope.attempts.nextAttemptAt, '2026-07-12T12:05:00.000Z');
  assert.equal(second.results[0].reason, 'retry scheduled for later');
  assert.equal(calls, 1);
});

test('source sync lock prevents overlapping queue writes', async () => {
  const lock = path.join(await mkdtemp(path.join(os.tmpdir(), 'source-sync-lock-')), 'active.lock');
  await (await import('node:fs/promises')).mkdir(lock);
  const result = await syncSourceContent({ client: fakeClient(), syncLock: lock });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'source sync already running');
});

test('source sync applies review backpressure before extraction or queue writes', async () => {
  const client = fakeClient();
  const notes = upsertDistributionEnvelope('', buildDistributionEnvelope(proposed));
  for (let index = 0; index < 12; index += 1) client.posts.push({ id: `pending-${index}`, status: 'generated', notes });
  const root = await mkdtemp(path.join(os.tmpdir(), 'source-sync-backpressure-'));
  const result = await syncSourceContent({ client, syncLock: path.join(root, 'active.lock'), maxPending: 12 });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'review backlog 12/12');
  assert.equal(client.posts.length, 12);
});

test('source sync selection cannot create more review items than the remaining ceiling', () => {
  const packages = Array.from({ length: 7 }, (_, index) => {
    const contentPackage = { ...structuredClone(proposed), id: `package-${index}` };
    contentPackage.variants.push({
      ...structuredClone(contentPackage.variants[0]),
      id: 'instagram-reels-v1',
      channel: 'instagram_reels',
    });
    return contentPackage;
  });
  const selected = takePackagesWithinReviewCapacity(packages, 12);
  assert.equal(selected.length, 6);
  assert.equal(selected.flatMap((entry) => entry.variants).length, 12);
});
