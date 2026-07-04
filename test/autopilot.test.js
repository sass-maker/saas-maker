import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoAcceptIntake, runAutopilotTick } from '../src/autopilot.js';

function stubClient(initialPosts = []) {
  const patches = [];
  const posts = [...initialPosts];
  return {
    patches,
    posts,
    listMarketingPosts: async (filters) => posts.filter((p) => !filters.status || p.status === filters.status),
    updateMarketingPost: async (id, patch) => {
      patches.push({ id, patch });
      const target = posts.find((p) => p.id === id);
      if (target) Object.assign(target, patch);
      return { skipped: false, data: { id, ...patch } };
    },
  };
}

test('autoAcceptIntake only flips posts that aged past the hold window', async () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const client = stubClient([
    { id: 'fresh', status: 'pending', created_at: '2026-06-16T11:50:00Z' },
    { id: 'aged', status: 'pending', created_at: '2026-06-16T11:00:00Z' },
    { id: 'unrelated', status: 'sent', created_at: '2026-06-16T10:00:00Z' },
  ]);
  const accepted = await autoAcceptIntake({
    client,
    now,
    holdWindowMs: 30 * 60_000,
    intakeStatus: 'pending',
    createdAtField: 'created_at',
    limit: 10,
    log: () => {},
  });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].postId, 'aged');
  assert.equal(client.patches.length, 1);
  assert.equal(client.patches[0].patch.status, 'accepted');
});

test('autoAcceptIntake skips posts missing or with unparseable created_at', async () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const client = stubClient([
    { id: 'missing', status: 'pending' },
    { id: 'bad', status: 'pending', created_at: 'definitely not a date' },
    { id: 'aged', status: 'pending', created_at: '2026-06-16T10:00:00Z' },
  ]);
  const accepted = await autoAcceptIntake({
    client,
    now,
    holdWindowMs: 30 * 60_000,
    intakeStatus: 'pending',
    createdAtField: 'created_at',
    limit: 10,
    log: () => {},
  });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].postId, 'aged');
});

test('autoAcceptIntake with hold window 0 accepts every pending post immediately', async () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const client = stubClient([
    { id: 'a', status: 'pending', created_at: '2026-06-16T11:59:59Z' },
    { id: 'b', status: 'pending', created_at: '2026-06-16T11:59:30Z' },
  ]);
  const accepted = await autoAcceptIntake({
    client,
    now,
    holdWindowMs: 0,
    intakeStatus: 'pending',
    createdAtField: 'created_at',
    limit: 10,
    log: () => {},
  });
  assert.equal(accepted.length, 2);
});

test('autoAcceptIntake respects a custom createdAtField name', async () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const client = stubClient([
    { id: 'a', status: 'pending', inserted_at: '2026-06-16T10:00:00Z' },
  ]);
  const accepted = await autoAcceptIntake({
    client,
    now,
    holdWindowMs: 30 * 60_000,
    intakeStatus: 'pending',
    createdAtField: 'inserted_at',
    limit: 10,
    log: () => {},
  });
  assert.equal(accepted.length, 1);
});

test('runAutopilotTick routes posts by channel through ChannelRoutingProvider', async () => {
  const seenChannels = [];
  const postingProvider = {
    post: async (post) => {
      seenChannels.push(post.channel);
      return {
        provider: 'auto',
        status: 'posted',
        channel: post.channel,
        assetUrl: post.result_url,
        externalUrl: 'https://x/posted',
        postedAt: '2026-06-16T12:00:01Z',
      };
    },
  };
  const client = stubClient([
    { id: 'yt', status: 'accepted', channel: 'youtube_shorts', project_slug: 'p', title: 't', hook: 'h', body: 'b', result_url: 'https://x/y.mp4' },
    { id: 'ig', status: 'accepted', channel: 'instagram_reels', project_slug: 'p', title: 't', hook: 'h', body: 'b', result_url: 'https://x/y.mp4' },
  ]);
  await runAutopilotTick({
    saasMakerClient: client,
    now: new Date('2026-06-16T12:00:00Z'),
    postingProvider,
    accounts: { youtube: {}, instagram: {} },
    render: { mode: 'mock' },
    log: () => {},
  });
  assert.deepEqual(seenChannels.sort(), ['instagram_reels', 'youtube_shorts']);
});

test('runAutopilotTick records post errors without corrupting intake', async () => {
  const client = stubClient([
    { id: 'aged', status: 'pending', channel: 'youtube_shorts', project_slug: 'p', title: 't', hook: 'h', body: 'b', result_url: 'https://x/y.mp4', created_at: '2020-01-01T00:00:00Z' },
  ]);
  const postingProvider = {
    post: async () => { throw new Error('YT 503'); },
  };
  const result = await runAutopilotTick({
    saasMakerClient: client,
    now: new Date('2026-06-16T12:00:00Z'),
    postingProvider,
    accounts: { youtube: {}, instagram: {} },
    render: { mode: 'mock' },
    log: () => {},
  });
  assert.equal(result.posted.results[0].failure.category, 'provider_down');
  const agedPost = client.posts.find((p) => p.id === 'aged');
  assert.equal(agedPost.status, 'accepted');
  assert.match(agedPost.notes, /posting_status: error/);
});

test('runAutopilotTick chains intake → render → post and returns each phase result', async () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const client = stubClient([
    {
      id: 'aged',
      status: 'pending',
      channel: 'youtube_shorts',
      project_slug: 'tutoring-q3',
      title: 'Hook 1',
      hook: 'Hook line',
      body: 'Body content',
      result_url: 'https://cdn.example.com/aged.mp4',
      created_at: '2026-06-16T10:00:00Z',
    },
    {
      id: 'ready',
      status: 'accepted',
      channel: 'youtube_shorts',
      project_slug: 'tutoring-q3',
      title: 'Ready',
      hook: 'Ready hook',
      body: 'Ready body',
      result_url: 'https://cdn.example.com/r.mp4',
      asset_url: 'https://cdn.example.com/r.mp4',
      scheduled_for: '2026-06-16T11:00:00Z',
    },
  ]);
  const postedCalls = [];
  const postingProvider = {
    post: async (post) => {
      postedCalls.push(post.id);
      return {
        provider: 'youtube',
        status: 'posted',
        channel: post.channel,
        assetUrl: post.result_url,
        externalUrl: 'https://youtube.com/shorts/x',
        postedAt: '2026-06-16T12:00:01Z',
      };
    },
  };
  const result = await runAutopilotTick({
    saasMakerClient: client,
    now,
    postingProvider,
    accounts: { youtube: {}, instagram: {} },
    render: { mode: 'mock' },
    log: () => {},
  });
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].postId, 'aged');
  assert.deepEqual(postedCalls.sort(), ['aged', 'ready']);
  assert.equal(client.posts.find((p) => p.id === 'ready').status, 'sent');
  assert.equal(client.posts.find((p) => p.id === 'aged').status, 'sent');
});
