import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createFfmpegRunner } from '../composer/ffmpeg.js';
import { createRenderer } from '../pipeline.js';
import { selfReviewRender } from '../reel-self-review.js';
import { resolvePresenter } from './presenter-library.js';

const DEFAULT_ARTIFACT_DIR = './artifacts/anonymous-brand-reel';

export async function renderPresenterLedReel(input, options = {}) {
  validateInput(input);
  // Proof and checksum validation deliberately precede renderer creation/calls.
  const presenter = await resolvePresenter({
    manifest: options.presenterManifest,
    manifestPath: options.presenterManifestPath,
    presenterId: input.presenterId,
    allowTestOnly: options.allowTestOnlyPresenter === true,
  });
  const baseRenderer = options.renderer ?? createRenderer(options.mode ?? input.brief.renderMode ?? 'kokoro-compose', options.rendererOptions);
  let baseRender = await baseRenderer.createVideo(input.brief, {
    anonymousBrandReel: true,
    websiteEvidence: input.website,
    supportingAssets: input.assets,
    creative: input.creative,
  });
  baseRender = await awaitCompletedRender(baseRender, baseRenderer, options);
  if (baseRender.status !== 'completed') throw new Error(`base renderer failed with status: ${baseRender.status}`);
  const sourceVideo = firstVideo(baseRender);
  if (!sourceVideo) throw new Error('base renderer completed without a video artifact');

  const taskId = `anonymous_${randomUUID()}`;
  const workDir = path.resolve(options.artifactDir ?? DEFAULT_ARTIFACT_DIR, taskId);
  await mkdir(workDir, { recursive: true });
  const outputPath = path.join(workDir, 'reel.mp4');
  const compose = options.compose ?? composePresenterOverlay;
  const composition = await compose({
    sourceVideo,
    presenter,
    outputPath,
    creative: input.creative,
    runFfmpeg: options.runFfmpeg,
    ffmpegOptions: options.ffmpegOptions,
  });
  const render = {
    provider: `presenter-overlay+${baseRender.provider ?? 'renderer'}`,
    externalTaskId: taskId,
    status: 'completed',
    videos: [outputPath],
    videoUrl: outputPath,
    durationSeconds: composition.durationSeconds ?? baseRender.durationSeconds ?? null,
    raw: {
      aspect: '9:16',
      presenterIncluded: true,
      captionsIncluded: true,
      narrationIncluded: true,
      ctaIncluded: true,
      composition,
      baseRender: summarizeBaseRender(baseRender),
    },
  };
  const review = options.review
    ? await options.review(render)
    : await selfReviewRender(render, options.reviewOptions);
  if (review?.ok !== true) {
    const issues = Array.isArray(review?.issues) && review.issues.length
      ? review.issues.join('; ')
      : 'technical review unavailable';
    throw new Error(`presenter reel review failed: ${issues}`);
  }
  render.provenance = buildArtifactProvenance({ input, presenter, baseRender, render, composition, review });
  return render;
}

export async function composePresenterOverlay(input) {
  if (typeof input.sourceVideo !== 'string' || !input.sourceVideo) throw new Error('sourceVideo is required');
  if (!input.presenter?.assetPath) throw new Error('verified presenter is required');
  if (typeof input.outputPath !== 'string' || !input.outputPath) throw new Error('outputPath is required');
  const runFfmpeg = input.runFfmpeg ?? createFfmpegRunner(input.ffmpegOptions).runFfmpeg;
  const presenterInput = input.presenter.mediaType.startsWith('image/')
    ? ['-loop', '1', '-framerate', '30', '-i', input.presenter.assetPath]
    : ['-stream_loop', '-1', '-i', input.presenter.assetPath];
  await runFfmpeg([
    '-y', '-i', input.sourceVideo, ...presenterInput,
    '-filter_complex',
    '[0:v]scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920[base];'
      + '[1:v]scale=420:720:force_original_aspect_ratio=decrease,format=rgba[presenter];'
      + '[base][presenter]overlay=W-w-48:H-h-170:shortest=1:format=auto[v]',
    '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', input.outputPath,
  ]);
  return {
    outputPath: input.outputPath,
    width: 1080,
    height: 1920,
    aspect: '9:16',
    presenterPlacement: 'lower-right-continuous',
    presenterProminentInOpening: true,
    presenterAppearsInLaterScene: true,
    supportingVisuals: true,
    narration: true,
    captions: true,
    onScreenText: true,
    cta: input.creative.cta,
  };
}

export function buildArtifactProvenance({ input, presenter, baseRender, render, composition, review }) {
  return Object.freeze({
    schema: 'anonymous-brand-reel.provenance.v1',
    website: Object.freeze({
      canonicalUrl: input.website.canonicalUrl,
      evidence: Object.freeze((input.website.evidence ?? []).map(compactEvidence)),
    }),
    assets: Object.freeze((input.assets ?? []).map((asset) => Object.freeze({
      url: asset.url ?? null,
      sourceUrl: asset.sourceUrl ?? input.website.canonicalUrl,
      sha256: asset.sha256 ?? null,
      kind: asset.kind ?? 'supporting-visual',
    }))),
    presenter: Object.freeze({
      id: presenter.id,
      packId: presenter.packId,
      sha256: presenter.sha256,
      mediaType: presenter.mediaType,
      commercialLicenseRef: presenter.commercialLicenseRef,
      modelReleaseRef: presenter.modelReleaseRef,
      allowedTransformations: Object.freeze([...presenter.allowedTransformations]),
      attribution: presenter.attribution,
    }),
    voice: Object.freeze({
      provider: input.voice?.provider ?? baseRender.raw?.voice?.provider ?? 'renderer-managed',
      voiceId: input.voice?.voiceId ?? baseRender.raw?.voice?.voiceId ?? null,
      model: input.voice?.model ?? baseRender.raw?.voice?.model ?? null,
    }),
    renderer: Object.freeze({
      provider: render.provider,
      baseProvider: baseRender.provider ?? null,
      baseTaskId: baseRender.externalTaskId ?? null,
      composition: 'ffmpeg-presenter-overlay-v1',
    }),
    timing: Object.freeze({
      renderedAt: new Date().toISOString(),
      durationSeconds: render.durationSeconds,
      width: composition.width ?? 1080,
      height: composition.height ?? 1920,
    }),
    review: Object.freeze({
      ok: review?.ok ?? null,
      issues: Object.freeze([...(review?.issues ?? [])]),
      probed: review?.probed ? Object.freeze({ ...review.probed }) : null,
    }),
  });
}

async function awaitCompletedRender(render, renderer, options) {
  if (render.status === 'completed' || render.status === 'failed') return render;
  if (typeof renderer.getStatus !== 'function') return render;
  const polls = Math.max(1, Math.min(120, Number(options.pollLimit ?? 60)));
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < polls; attempt += 1) {
    await sleep(Number(options.pollIntervalMs ?? 2_000));
    render = await renderer.getStatus(render.externalTaskId);
    if (render.status === 'completed' || render.status === 'failed') return render;
  }
  throw new Error('base renderer did not complete before the polling limit');
}

function validateInput(input) {
  if (!input?.brief || typeof input.brief !== 'object') throw new Error('brief is required');
  if (!input.website || typeof input.website.canonicalUrl !== 'string') throw new Error('website.canonicalUrl is required');
  if (!input.creative || typeof input.creative !== 'object') throw new Error('creative is required');
  for (const field of ['narration', 'captions', 'onScreenText', 'cta']) {
    const value = input.creative[field];
    if ((typeof value !== 'string' || !value.trim()) && (!Array.isArray(value) || value.length === 0)) {
      throw new Error(`creative.${field} is required`);
    }
  }
}

function firstVideo(render) {
  const candidates = [
    ...(Array.isArray(render.videos) ? render.videos : []),
    ...(Array.isArray(render.combinedVideos) ? render.combinedVideos : []),
    render.videoUrl,
  ];
  return candidates.find((value) => typeof value === 'string' && value) ?? null;
}

function compactEvidence(entry) {
  return Object.freeze({
    sourceUrl: entry.sourceUrl ?? entry.url ?? null,
    kind: entry.kind ?? 'claim',
    value: entry.value ?? entry.text ?? null,
  });
}

function summarizeBaseRender(render) {
  return {
    provider: render.provider ?? null,
    externalTaskId: render.externalTaskId ?? null,
    status: render.status,
  };
}
