import assert from 'node:assert/strict';
import test from 'node:test';

import { briefFromMarketingPost, normalizeVideoBrief, toMoneyPrinterRequest } from '../src/video-brief.js';
import { MoneyPrinterTurboAdapter } from '../src/adapters/moneyprinterturbo.js';
import { OpenShortsAdapter, toOpenShortsJob } from '../src/adapters/openshorts.js';
import { ReelMakerAdapter, splitBriefIntoScenes } from '../src/adapters/reel-maker.js';
import { publishRenderArtifacts, publishRenderArtifactsToR2 } from '../src/artifact-publisher.js';
import { createDraftVideo, createRenderer, getDraftVideoStatus, renderAcceptedMarketingPosts } from '../src/pipeline.js';
import { patchForPostingResult, postReadyMarketingVideos, postingGate } from '../src/posting.js';
import { renderPatchForMarketingPost, SaaSMakerClient } from '../src/saas-maker-client.js';

const reelBody = [
  'Script: show the user pain, product proof, then payoff.',
  'Shot list: messy inbox, generated answer, final profile.',
  'Captions: "stop answering this manually" and "send one link".',
  'Asset prompts: vertical phone footage and product UI.',
].join('\n');

test('normalizes a reel-platform video brief', () => {
  const brief = normalizeVideoBrief({
    id: 'brief-1',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'DM fatigue demo',
    hook: 'Stop answering the same question.',
    body: reelBody,
  });

  assert.equal(brief.channel, 'tiktok');
  assert.equal(brief.renderMode, 'stock');
  assert.equal(brief.durationSeconds, 20);
});

test('rejects reel bodies that are generic copy instead of video briefs', () => {
  assert.throws(() => normalizeVideoBrief({
    id: 'brief-2',
    projectSlug: 'linkchat',
    channel: 'youtube_shorts',
    title: 'Generic post',
    hook: 'Try this',
    body: 'This is just a promotional post.',
  }), /reel channel body/);
});

test('maps SaaS Maker marketing posts into video briefs', () => {
  const brief = briefFromMarketingPost({
    id: 'post-1',
    project_slug: 'reader',
    task_id: 'task-1',
    channel: 'instagram_reels',
    title: 'Saved articles are not learning',
    hook: 'You saved it. You did not learn it.',
    body: reelBody,
    cta: 'Review one saved article.',
  });

  assert.equal(brief.marketingPostId, 'post-1');
  assert.equal(brief.taskId, 'task-1');
});

test('converts video brief into MoneyPrinterTurbo request shape', () => {
  const req = toMoneyPrinterRequest(normalizeVideoBrief({
    id: 'brief-3',
    projectSlug: 'reader',
    channel: 'tiktok',
    title: 'Reading backlog',
    hook: 'Your read-it-later app became a guilt folder.',
    body: reelBody,
  }));

  assert.equal(req.video_aspect, '9:16');
  assert.equal(req.video_source, 'pexels');
  assert.match(req.video_script, /guilt folder/);
});

test('stock render mode maps to MoneyPrinterTurbo adapter', () => {
  assert.equal(createRenderer('stock').constructor.name, 'MoneyPrinterTurboAdapter');
});

test('remotion render mode maps to ReelMaker adapter', () => {
  assert.equal(createRenderer('remotion').constructor.name, 'ReelMakerAdapter');
  assert.equal(createRenderer('reel-maker').constructor.name, 'ReelMakerAdapter');
});

test('MoneyPrinterTurbo adapter posts to v1 video API and reads task id', async () => {
  const calls = [];
  const adapter = new MoneyPrinterTurboAdapter({
    baseUrl: 'http://mpt.local',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ data: { task_id: 'task-123' } });
    },
  });

  const result = await adapter.createVideo(normalizeVideoBrief({
    id: 'brief-4',
    projectSlug: 'starboard',
    channel: 'tiktok',
    title: 'Find starred repos',
    hook: 'You starred it because it mattered. Now you cannot find it.',
    body: reelBody,
  }));

  assert.equal(result.externalTaskId, 'task-123');
  assert.equal(calls[0].url, 'http://mpt.local/api/v1/videos');
});

test('OpenShorts adapter creates a guarded UGC job spec', async () => {
  const brief = normalizeVideoBrief({
    id: 'brief-openshorts',
    projectSlug: 'linkchat',
    channel: 'instagram_reels',
    title: 'UGC actor draft',
    hook: 'Your profile can answer first.',
    body: reelBody,
    cta: 'Ask one question.',
    renderMode: 'openshorts',
  });
  const spec = toOpenShortsJob(brief);
  assert.equal(spec.platform, 'instagram');
  assert.match(spec.guardrails.join('\n'), /Do not autopost/);

  const adapter = new OpenShortsAdapter({ jobDir: './tmp/openshorts-jobs' });
  const result = await adapter.createVideo(brief);
  assert.equal(result.provider, 'openshorts');
  assert.equal(result.status, 'queued');
  assert.match(result.raw.specPath, /job\.json$/);
});

test('ReelMaker adapter creates Remotion timeline and render job', async () => {
  const commands = [];
  const adapter = new ReelMakerAdapter({
    engineDir: './tmp/reel-maker-engine',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    commandRunner: async (command, args, options = {}) => {
      commands.push({ command, args, options });
      if (command === 'ffprobe') return { stdout: '2.5\n', stderr: '' };
      return { stdout: '', stderr: '' };
    },
  });
  const brief = normalizeVideoBrief({
    id: 'brief-remotion',
    projectSlug: 'linkchat',
    channel: 'tiktok',
    title: 'AI profile answers DMs',
    hook: 'Stop answering the same profile question manually.',
    body: reelBody,
    cta: 'Ask the profile one question.',
    renderMode: 'remotion',
  });

  const result = await adapter.createVideo(brief);

  assert.equal(result.provider, 'reel-maker');
  assert.equal(result.status, 'completed');
  assert.match(result.videos[0], /brief-remotion\.mp4$/);
  assert.equal(commands.some((call) => call.command === 'bunx' && call.args.includes('remotion')), true);
  assert.equal(splitBriefIntoScenes(brief).length, 3);
});

test('mock renderer creates a completed draft artifact', async () => {
  const result = await createDraftVideo({
    id: 'brief-5',
    projectSlug: 'swe-interview-prep',
    channel: 'tiktok',
    title: 'Know what you forgot',
    hook: 'You do not need more LeetCode. You need to know what decayed.',
    body: reelBody,
    renderMode: 'mock',
  }, {
    mock: { artifactDir: './tmp/test-artifacts' },
  });

  assert.equal(result.status, 'video_ready');
  assert.equal(result.render.provider, 'mock');
  assert.equal(result.render.videos.length, 1);

  const stored = await getDraftVideoStatus(result.id, {
    mock: { artifactDir: './tmp/test-artifacts' },
  });
  assert.equal(stored.status, 'video_ready');
  assert.equal(stored.id, result.id);
});

test('builds SaaS Maker marketing patch from a render result', () => {
  const patch = renderPatchForMarketingPost({
    provider: 'mock',
    externalTaskId: 'render-1',
    status: 'completed',
    videos: ['file:///tmp/render.mp4'],
  });

  assert.equal(patch.asset_url, 'file:///tmp/render.mp4');
  assert.match(patch.notes, /provider: mock/);
});

test('publishes local render artifacts to a configured public directory', async () => {
  const published = await publishRenderArtifacts({
    provider: 'mock',
    externalTaskId: 'render-public',
    status: 'completed',
    videos: ['./test/fixtures/accepted-marketing-posts.json'],
  }, {
    baseUrl: 'https://assets.example.test/reels',
    publicDir: './tmp/public-artifacts',
  });

  assert.equal(
    published.videos[0],
    'https://assets.example.test/reels/fixtures-accepted-marketing-posts.json',
  );
});

test('publishes local render artifacts through wrangler R2 when configured', async () => {
  const commands = [];
  const published = await publishRenderArtifactsToR2({
    provider: 'mock',
    externalTaskId: 'render-r2',
    status: 'completed',
    videos: ['./test/fixtures/accepted-marketing-posts.json'],
  }, {
    baseUrl: 'https://assets.example.test/reels',
    r2Bucket: 'reel-artifacts',
    commandRunner: async (command, args) => {
      commands.push({ command, args });
    },
  });

  assert.equal(
    published.videos[0],
    'https://assets.example.test/reels/fixtures-accepted-marketing-posts.json',
  );
  assert.equal(commands[0].command, 'npx');
  assert.deepEqual(commands[0].args.slice(0, 5), ['wrangler', 'r2', 'object', 'put', 'reel-artifacts/fixtures-accepted-marketing-posts.json']);
  assert.equal(commands[0].args.includes('--remote'), true);
});

test('publishes localhost render artifact URLs by downloading them first', async () => {
  const commands = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('fake-video-bytes', {
    headers: { 'content-type': 'video/mp4' },
  });
  try {
    const published = await publishRenderArtifactsToR2({
      provider: 'moneyprinterturbo',
      externalTaskId: 'render-http',
      status: 'completed',
      videos: ['http://127.0.0.1:8080/tasks/render-http/final-1.mp4'],
    }, {
      baseUrl: 'https://assets.example.test/reels',
      r2Bucket: 'reel-artifacts',
      commandRunner: async (command, args) => {
        commands.push({ command, args });
      },
    });

    assert.equal(published.videos[0], 'https://assets.example.test/reels/render-http-final-1.mp4');
    assert.match(commands[0].args[commands[0].args.indexOf('--file') + 1], /tmp\/downloaded-artifacts\/render-http\/final-1\.mp4$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SaaS Maker client skips sync when no session token is configured', async () => {
  const client = new SaaSMakerClient({ sessionToken: '' });
  const result = await client.updateMarketingPost('post-1', { result_url: 'file:///tmp/render.mp4' });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'missing SAASMAKER_SESSION_TOKEN');
});

test('SaaS Maker client patches marketing posts with bearer session token', async () => {
  const calls = [];
  const client = new SaaSMakerClient({
    baseUrl: 'https://api.example.test',
    sessionToken: 'session-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ data: { id: 'post-1' } });
    },
  });

  const result = await client.updateMarketingPost('post-1', { result_url: 'file:///tmp/render.mp4' });
  assert.equal(result.skipped, false);
  assert.equal(calls[0].url, 'https://api.example.test/v1/marketing/posts/post-1');
  assert.equal(calls[0].init.headers.authorization, 'Bearer session-token');
  assert.equal(JSON.parse(calls[0].init.body).result_url, 'file:///tmp/render.mp4');
});

test('SaaS Maker client lists marketing posts with filters', async () => {
  const calls = [];
  const client = new SaaSMakerClient({
    baseUrl: 'https://api.example.test',
    sessionToken: 'session-token',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ data: [{ id: 'post-1', status: 'accepted' }] });
    },
  });

  const posts = await client.listMarketingPosts({ status: 'accepted', channel: 'tiktok', limit: 2 });
  assert.equal(posts.length, 1);
  assert.match(calls[0].url, /status=accepted/);
  assert.match(calls[0].url, /channel=tiktok/);
  assert.equal(calls[0].init.headers.authorization, 'Bearer session-token');
});

test('createDraftVideo can sync a marketing post after mock render', async () => {
  const syncCalls = [];
  const result = await createDraftVideo({
    id: 'brief-sync',
    projectSlug: 'linkchat',
    marketingPostId: 'post-sync',
    channel: 'tiktok',
    title: 'Sync generated draft',
    hook: 'The draft is generated before posting.',
    body: reelBody,
    renderMode: 'mock',
  }, {
    mock: { artifactDir: './tmp/test-artifacts' },
    syncMarketingPost: true,
    saasMakerClient: {
      updateMarketingPost: async (id, patch) => {
        syncCalls.push({ id, patch });
        return { skipped: false, data: { id } };
      },
    },
  });

  assert.equal(result.status, 'video_ready');
  assert.equal(syncCalls[0].id, 'post-sync');
  assert.match(syncCalls[0].patch.notes, /reel-pipeline/);
});

test('getDraftVideoStatus syncs completed renders that were not synced on create', async () => {
  const syncCalls = [];
  const result = await createDraftVideo({
    id: 'brief-status-sync',
    projectSlug: 'linkchat',
    marketingPostId: 'post-status-sync',
    channel: 'tiktok',
    title: 'Status sync generated draft',
    hook: 'The draft syncs when status is read.',
    body: reelBody,
    renderMode: 'mock',
  }, {
    mock: { artifactDir: './tmp/test-artifacts' },
  });

  const synced = await getDraftVideoStatus(result.id, {
    mock: { artifactDir: './tmp/test-artifacts' },
    syncMarketingPost: true,
    saasMakerClient: {
      updateMarketingPost: async (id, patch) => {
        syncCalls.push({ id, patch });
        return { skipped: false, data: { id } };
      },
    },
  });

  assert.equal(synced.sync.skipped, false);
  assert.equal(syncCalls[0].id, 'post-status-sync');
  assert.match(syncCalls[0].patch.asset_url, /^file:\/\//);
});

test('renderAcceptedMarketingPosts renders accepted reel posts and skips completed artifacts', async () => {
  const syncCalls = [];
  const result = await renderAcceptedMarketingPosts({
    mode: 'mock',
    limit: 3,
    mock: { artifactDir: './tmp/test-artifacts' },
    saasMakerClient: {
      listMarketingPosts: async (filters) => {
        assert.equal(filters.status, 'accepted');
        return [
          {
            id: 'post-render-me',
            project_slug: 'linkchat',
            task_id: 'task-1',
            channel: 'tiktok',
            title: 'Render accepted post',
            hook: 'Accepted ideas should become drafts.',
            body: reelBody,
            cta: 'Review the draft.',
          },
          {
            id: 'post-skip-me',
            project_slug: 'reader',
            channel: 'instagram_reels',
            title: 'Already rendered',
            hook: 'Skip this.',
            body: reelBody,
            asset_url: 'https://example.test/render.mp4',
          },
          {
            id: 'post-blog',
            project_slug: 'reader',
            channel: 'blog',
            title: 'Non-video post',
            hook: 'Skip blog.',
            body: 'Blog copy.',
          },
        ];
      },
      updateMarketingPost: async (id, patch) => {
        syncCalls.push({ id, patch });
        return { skipped: false, data: { id } };
      },
    },
  });

  assert.equal(result.scanned, 3);
  assert.equal(result.eligible, 2);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].job.status, 'video_ready');
  assert.equal(result.results[1].skipped, true);
  assert.equal(syncCalls[0].id, 'post-render-me');
});

test('renderAcceptedMarketingPosts can sync public artifact URLs', async () => {
  const syncCalls = [];
  const result = await renderAcceptedMarketingPosts({
    mode: 'mock',
    limit: 1,
    mock: { artifactDir: './tmp/test-artifacts' },
    artifacts: {
      baseUrl: 'https://assets.example.test/reels',
      publicDir: './tmp/public-artifacts',
    },
    saasMakerClient: {
      listMarketingPosts: async () => ([
        {
          id: 'post-public-url',
          project_slug: 'linkchat',
          channel: 'tiktok',
          title: 'Public artifact URL',
          hook: 'The queue should get an HTTP asset URL.',
          body: reelBody,
        },
      ]),
      updateMarketingPost: async (id, patch) => {
        syncCalls.push({ id, patch });
        return { skipped: false, data: { id } };
      },
    },
  });

  assert.equal(result.results[0].job.status, 'video_ready');
  assert.match(syncCalls[0].patch.asset_url, /^https:\/\/assets\.example\.test\/reels\//);
});

test('postingGate requires acceptance, rendered asset, and schedule by default', () => {
  const readyPost = {
    id: 'post-ready',
    channel: 'tiktok',
    status: 'accepted',
    result_url: 'https://assets.example.test/reel.mp4',
    scheduled_for: '2026-01-01T00:00:00.000Z',
  };
  assert.equal(postingGate(readyPost, { now: new Date('2026-01-02T00:00:00.000Z') }).ready, true);
  assert.equal(postingGate({ ...readyPost, status: 'generated' }, { now: new Date('2026-01-02T00:00:00.000Z') }).reason, 'not accepted');
  assert.equal(postingGate({ ...readyPost, result_url: null, asset_url: null }, { now: new Date('2026-01-02T00:00:00.000Z') }).reason, 'missing rendered asset');
  assert.equal(postingGate({ ...readyPost, scheduled_for: null }, { now: new Date('2026-01-02T00:00:00.000Z') }).reason, 'not scheduled');
});

test('postReadyMarketingVideos requires explicit confirmation', async () => {
  await assert.rejects(
    () => postReadyMarketingVideos({ saasMakerClient: { listMarketingPosts: async () => [] } }),
    /confirmPost=true/,
  );
});

test('postReadyMarketingVideos prepares ready posts and patches marketing queue', async () => {
  const updates = [];
  const result = await postReadyMarketingVideos({
    confirmPost: true,
    includeUnscheduled: false,
    now: new Date('2026-01-02T00:00:00.000Z'),
    saasMakerClient: {
      listMarketingPosts: async () => ([
        {
          id: 'ready-post',
          channel: 'tiktok',
          status: 'accepted',
          title: 'Ready post',
          hook: 'Hook',
          cta: 'CTA',
          result_url: 'https://assets.example.test/reel.mp4',
          scheduled_for: '2026-01-01T00:00:00.000Z',
          notes: 'Existing notes',
        },
        {
          id: 'missing-schedule',
          channel: 'youtube_shorts',
          status: 'accepted',
          title: 'Missing schedule',
          result_url: 'https://assets.example.test/reel2.mp4',
        },
      ]),
      updateMarketingPost: async (id, patch) => {
        updates.push({ id, patch });
        return { skipped: false, data: { id, ...patch } };
      },
    },
  });

  assert.equal(result.scanned, 2);
  assert.equal(result.results[0].posted.status, 'prepared');
  assert.equal(result.results[1].skipped, true);
  assert.equal(updates[0].id, 'ready-post');
  assert.equal(updates[0].patch.status, 'accepted');
  assert.equal('posted_at' in updates[0].patch, false);
  assert.match(updates[0].patch.notes, /posting_provider: manual/);
});

test('patchForPostingResult marks sent only after a real post', () => {
  const patch = patchForPostingResult({
    result_url: 'https://assets.example.test/reel.mp4',
    notes: 'Existing notes',
  }, {
    provider: 'upload-post',
    status: 'posted',
    externalUrl: 'https://tiktok.example.test/post/1',
    postedAt: '2026-01-02T00:00:00.000Z',
  });

  assert.equal(patch.status, 'sent');
  assert.equal(patch.posted_at, '2026-01-02T00:00:00.000Z');
  assert.equal(patch.result_url, 'https://tiktok.example.test/post/1');
});
