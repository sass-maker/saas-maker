import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createFixtureClient, loadFixtureClient } from '../src/autopilot.js';

test('createFixtureClient filters by status, project_slug, channel', async () => {
  const client = createFixtureClient([
    { id: 'a', status: 'pending', project_slug: 'p1', channel: 'youtube_shorts' },
    { id: 'b', status: 'accepted', project_slug: 'p1', channel: 'youtube_shorts' },
    { id: 'c', status: 'pending', project_slug: 'p2', channel: 'instagram_reels' },
  ]);
  assert.deepEqual(
    (await client.listMarketingPosts({ status: 'pending' })).map((p) => p.id),
    ['a', 'c'],
  );
  assert.deepEqual(
    (await client.listMarketingPosts({ status: 'pending', project_slug: 'p1' })).map((p) => p.id),
    ['a'],
  );
  assert.deepEqual(
    (await client.listMarketingPosts({ channel: 'instagram_reels' })).map((p) => p.id),
    ['c'],
  );
});

test('createFixtureClient mutates posts so later listMarketingPosts reflects patches', async () => {
  const client = createFixtureClient([
    { id: 'a', status: 'pending' },
  ]);
  await client.updateMarketingPost('a', { status: 'accepted' });
  const pending = await client.listMarketingPosts({ status: 'pending' });
  const accepted = await client.listMarketingPosts({ status: 'accepted' });
  assert.equal(pending.length, 0);
  assert.equal(accepted.length, 1);
  assert.equal(client.updates.length, 1);
});

test('loadFixtureClient reads JSON from disk (array form)', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fix-'));
  try {
    const file = path.join(dir, 'p.json');
    await writeFile(file, JSON.stringify([{ id: 'x', status: 'pending' }]));
    const client = await loadFixtureClient(file);
    assert.equal(client.posts.length, 1);
    assert.equal(client.posts[0].id, 'x');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadFixtureClient accepts the { data: [...] } wrapper shape too', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fix-'));
  try {
    const file = path.join(dir, 'p.json');
    await writeFile(file, JSON.stringify({ data: [{ id: 'y', status: 'accepted' }] }));
    const client = await loadFixtureClient(file);
    assert.equal(client.posts.length, 1);
    assert.equal(client.posts[0].id, 'y');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
