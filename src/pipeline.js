import { MoneyPrinterTurboAdapter } from './adapters/moneyprinterturbo.js';
import { MockRenderer } from './adapters/mock-renderer.js';
import { OpenShortsAdapter } from './adapters/openshorts.js';
import { ReelMakerAdapter } from './adapters/reel-maker.js';
import { publishRenderArtifacts } from './artifact-publisher.js';
import { FileJobStore } from './job-store.js';
import { assertRenderableReel, attachReelRender } from './reel-intake.js';
import { briefFromMarketingPost, normalizeVideoBrief } from './video-brief.js';
import { renderPatchForMarketingPost, SaaSMakerClient } from './saas-maker-client.js';

export function createRenderer(mode = 'mock', options = {}) {
  if (mode === 'stock') return new MoneyPrinterTurboAdapter(options.moneyprinterturbo);
  if (mode === 'moneyprinterturbo') return new MoneyPrinterTurboAdapter(options.moneyprinterturbo);
  if (mode === 'openshorts') return new OpenShortsAdapter(options.openshorts);
  if (mode === 'remotion' || mode === 'reel-maker') return new ReelMakerAdapter(options.reelMaker ?? options.reelmaker);
  if (mode === 'mock') return new MockRenderer(options.mock);
  throw new Error(`unsupported renderer mode: ${mode}`);
}

export async function createDraftVideo(input, options = {}) {
  const brief = normalizeVideoBrief(input);
  const renderer = options.renderer ?? createRenderer(options.mode ?? brief.renderMode ?? 'mock', options);
  const store = options.store ?? new FileJobStore(options.storeOptions);
  const result = await renderer.createVideo(brief);
  const render = result.status === 'completed' ? await publishRenderArtifacts(result, options.artifacts) : result;
  const job = await store.save({
    id: render.externalTaskId,
    brief,
    render,
    sync: null,
    status: render.status === 'completed' ? 'video_ready' : 'rendering',
  });

  if (options.syncMarketingPost && brief.marketingPostId && render.status === 'completed') {
    return syncMarketingPostForJob(job, options);
  }

  return job;
}

export async function getDraftVideoStatus(id, options = {}) {
  const store = options.store ?? new FileJobStore(options.storeOptions);
  const job = await store.get(id);
  if (!job) return null;
  const renderer = options.renderer ?? createRenderer(options.mode ?? job.brief.renderMode ?? 'mock', options);
  if (job.render?.status === 'completed' || !renderer.getStatus) {
    if (options.syncMarketingPost && job.brief.marketingPostId && !job.sync) {
      return syncMarketingPostForJob(job, options);
    }
    return job;
  }
  const render = await renderer.getStatus(job.render.externalTaskId);
  const updatedJob = await store.save({
    ...job,
    render,
    status: render.status === 'completed' ? 'video_ready' : render.status,
  });
  if (options.syncMarketingPost && updatedJob.brief.marketingPostId && render.status === 'completed' && !updatedJob.sync) {
    return syncMarketingPostForJob(updatedJob, options);
  }
  return updatedJob;
}

export async function syncMarketingPostForJob(job, options = {}) {
  if (!job?.brief?.marketingPostId) return job;
  const store = options.store ?? new FileJobStore(options.storeOptions);
  const client = options.saasMakerClient ?? new SaaSMakerClient(options.saasMaker);
  const render = await publishRenderArtifacts(job.render, options.artifacts);
  const sync = await client.updateMarketingPost(
    job.brief.marketingPostId,
    renderPatchForMarketingPost(render),
  );
  return store.save({ ...job, render, sync });
}

export async function renderAcceptedMarketingPosts(options = {}) {
  const client = options.saasMakerClient ?? new SaaSMakerClient(options.saasMaker);
  const posts = await client.listMarketingPosts({
    status: 'accepted',
    limit: options.limit ?? 20,
    ...(options.projectSlug ? { project_slug: options.projectSlug } : {}),
    ...(options.channel ? { channel: options.channel } : {}),
  });
  const reelPosts = posts.filter((post) => ['tiktok', 'instagram_reels', 'youtube_shorts'].includes(post.channel));
  const results = [];

  for (const post of reelPosts.slice(0, options.limit ?? 20)) {
    if (post.asset_url || post.result_url) {
      results.push({ postId: post.id, skipped: true, reason: 'already has render artifact' });
      continue;
    }

    const job = await createDraftVideo(briefFromMarketingPost(post), {
      ...options,
      syncMarketingPost: true,
      mode: options.mode ?? 'mock',
    });

    let current = job;
    const pollLimit = Number(options.pollLimit ?? 60);
    for (let attempt = 0; current.status !== 'video_ready' && attempt < pollLimit; attempt += 1) {
      await sleep(Number(options.pollIntervalMs ?? 2000));
      current = await getDraftVideoStatus(current.id, {
        ...options,
        syncMarketingPost: true,
        mode: options.mode ?? 'mock',
      });
      if (!current) throw new Error(`render disappeared from job store: ${job.id}`);
      if (current.status === 'failed') break;
    }

    results.push({ postId: post.id, job: current });
  }

  return { scanned: posts.length, eligible: reelPosts.length, results };
}

export async function renderReelDraft(id, options = {}) {
  const reelStore = options.reelStore;
  if (!reelStore) throw new Error('reelStore is required');
  const record = await reelStore.get(id);
  if (!record) return null;
  assertRenderableReel(record, options);
  const mode = options.mode ?? record.brief?.renderMode ?? 'mock';
  const job = await createDraftVideo({ ...record.brief, renderMode: mode }, {
    ...options,
    mode,
    syncMarketingPost: Boolean(record.brief?.marketingPostId),
  });
  const reel = await attachReelRender(id, job, { reelStore });
  return { reel, job };
}

export function createRenderResponse(job) {
  return {
    id: job.id,
    brief: job.brief,
    render: job.render,
    sync: job.sync,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
