import { renderAcceptedMarketingPosts } from '../src/pipeline.js';
import { postReadyMarketingVideos } from '../src/posting.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REPORT_PATH = process.env.FULL_PIPELINE_SMOKE_REPORT ?? 'tmp/full-pipeline-smoke/report.json';

const queue = [
  {
    id: 'full-smoke-post',
    project_slug: 'linkchat',
    task_id: 'full-smoke-task',
    channel: 'tiktok',
    status: 'accepted',
    title: 'Full pipeline smoke reel',
    hook: 'Accepted marketing ideas should become gated video handoffs.',
    body: [
      'Script: show the marketing idea turning into a draft video.',
      'Shot list: queue item, generated artifact, manual posting checklist.',
      'Captions: accept idea, render draft, post only after approval.',
      'Asset prompts: vertical product UI and queue workflow.',
    ].join('\n'),
    cta: 'Review the draft before posting.',
    scheduled_for: '2026-01-01T00:00:00.000Z',
  },
];

const patches = [];
const client = {
  listMarketingPosts: async (filters) => {
    if (filters.status !== 'accepted') throw new Error(`unexpected status filter: ${filters.status}`);
    return queue;
  },
  updateMarketingPost: async (id, patch) => {
    patches.push({ id, patch });
    const index = queue.findIndex((post) => post.id === id);
    if (index >= 0) queue[index] = { ...queue[index], ...patch };
    return { skipped: false, data: { id, ...patch } };
  },
};

const render = await renderAcceptedMarketingPosts({
  mode: 'mock',
  limit: 1,
  mock: { artifactDir: './tmp/full-pipeline/artifacts' },
  artifacts: {
    publicDir: './tmp/full-pipeline/public',
    baseUrl: 'https://assets.example.test/reels',
  },
  saasMakerClient: client,
});

const post = await postReadyMarketingVideos({
  confirmPost: true,
  limit: 1,
  now: new Date('2026-01-02T00:00:00.000Z'),
  saasMakerClient: client,
  manual: {
    now: () => new Date('2026-01-02T00:00:00.000Z'),
  },
});

const renderedPatch = patches.find((patch) => patch.patch.asset_url);
const postPatch = patches.find((patch) => /posting_provider: manual/.test(patch.patch.notes ?? ''));

if (!renderedPatch?.patch.asset_url?.startsWith('https://assets.example.test/reels/')) {
  throw new Error('render step did not sync a public asset URL');
}
if (!postPatch) {
  throw new Error('post step did not sync manual handoff notes');
}
if ('posted_at' in postPatch.patch) {
  throw new Error('manual handoff must not set posted_at');
}
if (postPatch.patch.status !== 'accepted') {
  throw new Error(`manual handoff must keep status accepted, got ${postPatch.patch.status}`);
}

const report = {
  schema: 'reel-pipeline.full-pipeline-smoke.v1',
  ok: true,
  render,
  post,
  finalPost: queue[0],
  reportPath: REPORT_PATH,
  generatedAt: new Date().toISOString(),
};

await mkdir(path.dirname(REPORT_PATH), { recursive: true });
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
