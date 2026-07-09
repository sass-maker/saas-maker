import { MoneyPrinterTurboAdapter } from './adapters/moneyprinterturbo.js';
import { MockRenderer } from './adapters/mock-renderer.js';
import { ReelMakerAdapter } from './adapters/reel-maker.js';
import { GrokVideoAdapter } from './adapters/grok-video.js';
import { AsciiAnimationAdapter } from './adapters/ascii-animation.js';
import { HtmlCompositionAdapter } from './adapters/html-composition.js';
import { KokoroComposeAdapter } from './adapters/kokoro-compose.js';
import { publishRenderArtifacts } from './artifact-publisher.js';
import { FileJobStore } from './job-store.js';
import { assertRenderableReel, attachReelRender } from './reel-intake.js';
import { briefFromMarketingPost, normalizeVideoBrief } from './video-brief.js';
import { renderPatchForMarketingPost, SaaSMakerClient } from './saas-maker-client.js';
import { ProductProofCapture, loadPlaywrightFactory } from './product-proof-capture.js';
import { buildVariantPlan } from './reel-templates.js';
import { scoreVariant } from './reel-quality.js';
import { selfReviewRender } from './reel-self-review.js';

let cachedProductProofCapture = null;

export async function resolveProductProofCapture(options = {}) {
  if (options.productProofCapture) return options.productProofCapture;
  if (options.reelMaker?.productProofCapture) return options.reelMaker.productProofCapture;
  if (cachedProductProofCapture) return cachedProductProofCapture;
  const browserFactory = await loadPlaywrightFactory();
  if (!browserFactory) return null;
  cachedProductProofCapture = new ProductProofCapture({
    outputDir: options.proofOutputDir ?? process.env.REEL_PROOF_DIR ?? './tmp/product-proof',
    browserFactory,
    logger: options.logger,
  });
  return cachedProductProofCapture;
}

export function createRenderer(mode = 'mock', options = {}) {
  if (mode === 'stock') return new MoneyPrinterTurboAdapter(options.moneyprinterturbo);
  if (mode === 'moneyprinterturbo') return new MoneyPrinterTurboAdapter(options.moneyprinterturbo);
  if (mode === 'grok' || mode === 'grok-video' || mode === 'grok-videos') return new GrokVideoAdapter(options.grokVideo ?? options.grok ?? {});
  if (mode === 'ascii' || mode === 'ascii-animation' || mode === 'ascii-fable' || mode === 'askai') return new AsciiAnimationAdapter(options.asciiAnimation ?? options.ascii ?? options.askai ?? {});
  if (mode === 'html' || mode === 'html-composition' || mode === 'web-composition') return new HtmlCompositionAdapter(options.htmlComposition ?? options.html ?? {});
  if (mode === 'kokoro' || mode === 'kokoro-compose') return new KokoroComposeAdapter(options.kokoroCompose ?? options.kokoro ?? {});
  if (mode === 'openshorts' || mode === 'ugc_actor') {
    throw new Error('openshorts/ugc_actor was removed; use mock or stock (MoneyPrinterTurbo)');
  }
  if (mode === 'remotion' || mode === 'reel-maker') {
    return new ReelMakerAdapter({
      ...(options.reelMaker ?? options.reelmaker ?? {}),
      productProofCapture: options.productProofCapture
        ?? options.reelMaker?.productProofCapture
        ?? null,
    });
  }
  if (mode === 'mock') return new MockRenderer(options.mock);
  throw new Error(`unsupported renderer mode: ${mode}`);
}

export async function renderReelVariants(brief, options = {}) {
  const variantCount = Math.max(1, Math.min(6, Number(options.variantCount ?? 1)));
  const mode = options.mode ?? brief.renderMode ?? 'mock';
  const plan = buildVariantPlan(brief, { variantCount });
  const productProofCapture = (mode === 'remotion' || mode === 'reel-maker')
    ? await resolveProductProofCapture(options)
    : null;
  const renderOptions = productProofCapture
    ? {
      ...options,
      productProofCapture,
      reelMaker: { ...(options.reelMaker ?? {}), productProofCapture },
    }
    : options;
  const renderer = options.renderer ?? createRenderer(mode, renderOptions);
  const variants = [];
  const renderLog = [];

  for (const entry of plan) {
    try {
      const variantBrief = { ...brief, hook: entry.hook, cta: entry.cta, template: entry.template.id };
      const raw = await renderer.createVideo(variantBrief, {
        variantId: entry.variantId,
        template: entry.template.id,
        hook: entry.hook,
        cta: entry.cta,
      });
      const published = raw.status === 'completed' ? await publishRenderArtifacts(raw, options.artifacts) : raw;
      // Probe the real file (raw still holds the local path; published may have
      // been rewritten to upload URLs). Verified facts beat claimed metadata.
      const review = raw.status === 'completed'
        ? await selfReviewRender(raw, {
          commandRunner: options.commandRunner ?? options.reelMaker?.commandRunner,
          ffprobePath: options.ffprobePath,
        })
        : null;
      const score = scoreVariant({
        brief: variantBrief,
        variant: { hook: entry.hook, cta: entry.cta },
        template: entry.template,
        proof: {
          type: raw.raw?.proof?.type,
          proofType: raw.proofType ?? raw.raw?.proof?.proofType ?? 'generated_card',
          paths: raw.proofPaths ?? raw.raw?.proof?.paths ?? [],
        },
        render: {
          ...published,
          aspect: review?.probed?.aspect ?? raw.raw?.aspect ?? '9:16',
          durationSeconds: review?.probed?.durationSeconds ?? raw.durationSeconds,
        },
      });
      if (review?.issues?.length) {
        score.reasons.push(...review.issues.map((issue) => `self-review: ${issue}`));
      }
      const variant = {
        variantId: entry.variantId,
        template: entry.template.id,
        templateLabel: entry.template.label,
        proofType: raw.proofType ?? 'generated_card',
        hook: entry.hook,
        cta: entry.cta,
        captionText: raw.captionText ?? null,
        assetUrl: firstUrl(published) ?? null,
        thumbnailUrl: typeof raw.thumbnail === 'string' ? raw.thumbnail : null,
        durationSeconds: review?.probed?.durationSeconds ?? raw.durationSeconds ?? null,
        qualityScore: score.overall,
        qualityScores: score.scores,
        slideshowRisk: score.slideshowRisk,
        selfReview: review ?? null,
        qualityReasons: score.reasons,
        renderLog: raw.renderLog ?? [],
        status: score.status,
        provider: raw.provider,
        externalTaskId: raw.externalTaskId,
        createdAt: new Date().toISOString(),
      };
      variants.push(variant);
      renderLog.push(`variant=${entry.variantId} status=${score.status} score=${score.overall}`);
    } catch (error) {
      renderLog.push(`variant=${entry.variantId} failed: ${formatError(error)}`);
      variants.push({
        variantId: entry.variantId,
        template: entry.template.id,
        templateLabel: entry.template.label,
        status: 'video_rejected',
        qualityReasons: [`render failed: ${formatError(error)}`],
        qualityScore: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { variants, renderLog };
}

function firstUrl(published) {
  if (!published) return null;
  if (Array.isArray(published.videos)) return published.videos[0] ?? null;
  if (Array.isArray(published.combinedVideos)) return published.combinedVideos[0] ?? null;
  return published.videoUrl ?? null;
}

function formatError(error) {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.message;
  return String(error);
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
    for (let attempt = 0; current?.status !== 'video_ready' && attempt < pollLimit; attempt += 1) {
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
  const variantCount = Math.max(1, Math.min(6, Number(options.variantCount ?? 1)));
  const wantsVariants = variantCount > 1;
  const wantsProductProof = (mode === 'remotion' || mode === 'reel-maker')
    && (record.brief?.productUrl || record.brief?.proofUrl || record.brief?.targetRoute
      || (Array.isArray(record.brief?.screenshots) && record.brief.screenshots.length)
      || (Array.isArray(record.brief?.demoSteps) && record.brief.demoSteps.length));

  if (wantsVariants || wantsProductProof) {
    const productProofCapture = await resolveProductProofCapture(options);
    const { variants, renderLog } = await renderReelVariants(
      { ...record.brief, renderMode: mode },
      {
        ...options,
        mode,
        variantCount,
        productProofCapture,
        reelMaker: { ...(options.reelMaker ?? {}), productProofCapture },
      },
    );
    const reel = await attachReelRender(id, { variants, renderLog, job: { id: `${record.id}-render-${Date.now()}` } }, { reelStore });
    return { reel, variants, renderLog };
  }

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
