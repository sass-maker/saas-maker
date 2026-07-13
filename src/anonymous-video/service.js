import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { FileJobStore } from '../job-store.js';
import { buildEvidenceBackedBrief } from './brand-brief.js';
import { renderPresenterLedReel } from './renderer.js';
import { WebsiteIntakeError, intakeBrandWebsite } from './website-intake.js';

export function createAnonymousVideoService(options = {}) {
  const store = options.store ?? new FileJobStore({
    dir: options.jobDir ?? process.env.REEL_ANONYMOUS_JOB_DIR ?? '.reel-pipeline/anonymous-videos',
  });
  const intake = options.intake ?? intakeBrandWebsite;
  const render = options.render ?? renderPresenterLedReel;
  const inFlight = new Map();

  async function create(input) {
    const url = validateSubmission(input);
    const id = `video_${randomUUID()}`;
    const job = await store.save({
      id,
      status: 'processing',
      stage: 'queued',
      sourceUrl: url.href,
      artifact: null,
      error: null,
    });
    const work = Promise.resolve()
      .then(() => processJob(job))
      .catch(() => {})
      .finally(() => inFlight.delete(id));
    inFlight.set(id, work);
    return safeJob(job);
  }

  async function processJob(job) {
    try {
      await store.save({ ...job, status: 'processing', stage: 'understanding_brand' });
      const website = await intake(job.sourceUrl, options.intakeOptions ?? {});
      const brandBrief = buildEvidenceBackedBrief(website);
      await store.save({ ...job, status: 'processing', stage: 'composing_reel', brand: safeBrandSummary(website), brief: brandBrief });
      const renderInput = renderInputFromBrand(website, brandBrief, options);
      const rendered = await render(renderInput, options.renderOptions ?? {});
      if (rendered?.status !== 'completed') throw new Error(`renderer ended with status: ${rendered?.status ?? 'unknown'}`);
      const artifactPath = firstVideo(rendered);
      if (!artifactPath || /^https?:\/\//.test(artifactPath)) {
        throw new Error('anonymous renderer did not return a local reviewed MP4');
      }
      const metadata = await stat(artifactPath);
      if (!metadata.isFile() || metadata.size < 1) throw new Error('reviewed MP4 artifact is empty');
      const completed = await store.save({
        ...job,
        status: 'completed',
        stage: 'completed',
        brand: safeBrandSummary(website),
        brief: brandBrief,
        artifact: {
          path: path.resolve(artifactPath),
          size: metadata.size,
          contentType: 'video/mp4',
          filename: `${safeSlug(website.brand?.name ?? 'brand')}-reel.mp4`,
          reviewed: true,
          aspect: rendered.raw?.aspect ?? '9:16',
          durationSeconds: rendered.durationSeconds ?? null,
          provider: rendered.provider ?? null,
          presenterIncluded: rendered.raw?.presenterIncluded === true,
          captionsIncluded: rendered.raw?.captionsIncluded === true,
          narrationIncluded: rendered.raw?.narrationIncluded === true,
          provenance: rendered.provenance ?? null,
        },
        error: null,
      });
      return completed;
    } catch (error) {
      return store.save({
        ...job,
        status: 'failed',
        stage: 'failed',
        artifact: null,
        error: classifyFailure(error),
      });
    }
  }

  return Object.freeze({
    create,
    async get(id) {
      const job = await store.get(validateId(id));
      return job ? safeJob(job) : null;
    },
    async openArtifact(id) {
      const job = await store.get(validateId(id));
      if (!job) return null;
      if (job.status !== 'completed' || !job.artifact?.reviewed) return { state: job.status };
      return { ...job.artifact, state: 'completed' };
    },
    async wait(id) {
      await inFlight.get(id);
      const job = await store.get(validateId(id));
      return job ? safeJob(job) : null;
    },
  });
}

function renderInputFromBrand(website, brief, options) {
  const narration = brief.scenes.map((scene) => scene.narration).join(' ');
  const captions = brief.scenes.map((scene) => scene.onScreenText);
  const cta = brief.scenes.at(-1)?.onScreenText ?? 'Visit the website';
  return {
    brief: {
      id: `anonymous-${randomUUID()}`,
      projectSlug: 'anonymous-brand-reel',
      channel: 'instagram_reels',
      title: brief.title,
      hook: brief.scenes[0]?.onScreenText ?? brief.title,
      body: [
        `Script: ${narration}`,
        `Shot list: ${brief.scenes.map((scene) => scene.kind).join('; ')}.`,
        `Captions: ${captions.join(' · ')}`,
        `Asset prompts: use cited website colors, imagery, and page captures from ${website.canonicalUrl}.`,
      ].join('\n'),
      cta,
      productUrl: website.canonicalUrl,
      proofType: 'product_artifact',
      renderMode: options.renderMode ?? 'kokoro-compose',
    },
    website: {
      canonicalUrl: website.canonicalUrl,
      evidence: website.brand.facts,
      fetchedAt: website.fetchedAt,
    },
    assets: [
      ...website.brand.images.map((asset) => ({ ...asset, kind: asset.role ?? 'supporting-visual' })),
      ...website.captures.map((asset) => ({ ...asset, kind: 'page-capture' })),
    ],
    creative: { narration, captions, onScreenText: captions, cta },
  };
}

function safeJob(job) {
  const artifact = job.status === 'completed' && job.artifact?.reviewed
    ? {
      reviewed: true,
      aspect: job.artifact.aspect,
      durationSeconds: job.artifact.durationSeconds,
      provider: job.artifact.provider,
      presenterIncluded: job.artifact.presenterIncluded,
      captionsIncluded: job.artifact.captionsIncluded,
      narrationIncluded: job.artifact.narrationIncluded,
      provenance: job.artifact.provenance,
      previewUrl: `/api/videos/${encodeURIComponent(job.id)}/preview`,
      downloadUrl: `/api/videos/${encodeURIComponent(job.id)}/download`,
    }
    : null;
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    sourceUrl: job.sourceUrl,
    brand: job.brand ?? null,
    artifact,
    error: job.error ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function safeBrandSummary(website) {
  return {
    name: website.brand?.name ?? null,
    canonicalUrl: website.canonicalUrl,
    evidenceCount: website.brand?.facts?.length ?? 0,
    imageCount: website.brand?.images?.length ?? 0,
  };
}

function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw inputError('a website URL is required');
  let url;
  try { url = new URL(input.url); } catch { throw inputError('a valid HTTPS website URL is required'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw inputError('website URL must use HTTPS without credentials or a custom port');
  }
  url.hash = '';
  return url;
}

function validateId(id) {
  if (typeof id !== 'string' || !/^video_[0-9a-f-]{36}$/.test(id)) return '__invalid__';
  return id;
}

function inputError(message) {
  const error = new Error(message);
  error.code = 'invalid_url';
  return error;
}

function classifyFailure(error) {
  if (error instanceof WebsiteIntakeError) return { code: error.code.toLowerCase(), message: error.message };
  if (typeof error?.code === 'string' && error.code.startsWith('presenter_')) {
    return { code: error.code, message: error.message };
  }
  return { code: 'render_failed', message: error instanceof Error ? error.message : 'video generation failed' };
}

function firstVideo(render) {
  return render.videoUrl ?? render.videos?.[0] ?? render.combinedVideos?.[0] ?? null;
}

function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'brand';
}
