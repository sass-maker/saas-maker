import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateMarketingProgram } from '../lib/marketing-program.mjs';
import { buildMarketingSnapshot } from '../lib/marketing-snapshot.mjs';

const registry = validateMarketingProgram(JSON.parse(await readFile(new URL('../config/marketing-program.json', import.meta.url), 'utf8')));

function envelope(input = {}) {
  const payload = {
    contentPackage: { brand: { slug: input.brand ?? 'karte' } },
    mediaReceipt: input.produced ? { channel: 'youtube_shorts' } : null,
    publicationReceipt: input.published ? { provider: 'youtube', status: 'posted', channel: 'youtube_shorts', recordedAt: '2026-07-12T10:00:00Z' } : null,
    attempts: { state: input.failed ? 'failed' : 'idle' },
  };
  return `fleet_distribution_v1:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

test('snapshot canonicalizes aliases without mutating source rows', () => {
  const posts = [
    { id: 'private-id', project_slug: 'linkchat', status: 'generated', title: 'private copy', body: 'never publish', created_at: '2026-07-10T00:00:00Z' },
    { project_slug: 'karte', status: 'sent', notes: `${envelope({ produced: true, published: true })}\nmetrics_synced_at: 2026-07-12T11:00:00Z`, updated_at: '2026-07-12T11:00:00Z' },
  ];
  const before = structuredClone(posts);
  const snapshot = buildMarketingSnapshot(posts, registry, { now: '2026-07-13T00:00:00Z' });
  const karte = snapshot.projects.find((project) => project.slug === 'karte');
  assert.equal(karte.stages.queued, 1);
  assert.equal(karte.stages.published, 1);
  assert.equal(karte.stages.measured, 1);
  assert.deepEqual(posts, before);
});

test('snapshot calculates freshness, review age, failures, stages, and next action', () => {
  const posts = [
    { project_slug: 'pace', status: 'generated', created_at: '2026-07-01T00:00:00Z' },
    { project_slug: 'pace', status: 'accepted', notes: envelope({ failed: true }), updated_at: '2026-07-12T00:00:00Z' },
    { project_slug: 'high-signal', status: 'accepted', asset_url: 'https://assets.test/video.mp4', updated_at: '2026-07-12T12:00:00Z' },
  ];
  const snapshot = buildMarketingSnapshot(posts, registry, { now: '2026-07-13T00:00:00Z' });
  const pace = snapshot.projects.find((project) => project.slug === 'pace');
  const highSignal = snapshot.projects.find((project) => project.slug === 'high-signal');
  assert.equal(pace.oldestReviewAgeHours, 288);
  assert.equal(pace.failures, 1);
  assert.equal(pace.nextAction, 'Recover failed distribution');
  assert.equal(highSignal.stages.produced, 1);
  assert.equal(highSignal.nextAction, 'Review distribution request');
});

test('public snapshot contains no post content or private identifiers', () => {
  const snapshot = buildMarketingSnapshot([{ project_slug: 'karte', status: 'generated', id: 'secret-id', owner_id: 'owner', task_id: 'task',
    title: 'unpublished title', hook: 'unpublished hook', body: 'unpublished body', notes: 'unpublished notes', result_url: 'https://private.test/result' }], registry,
  { now: '2026-07-13T00:00:00Z' });
  const serialized = JSON.stringify(snapshot);
  for (const secret of ['secret-id', 'owner', 'task', 'unpublished title', 'unpublished hook', 'unpublished body', 'unpublished notes', 'private.test']) {
    assert.equal(serialized.includes(secret), false);
  }
});
