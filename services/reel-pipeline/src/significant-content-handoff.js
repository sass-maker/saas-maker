import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createRenderer } from './pipeline.js';
import { normalizeVideoBrief } from './video-brief.js';
import { assessRender } from './studio/quality.js';
import { IdeaStore } from './studio/idea-store.js';

export const SIGNIFICANT_REELS_SCHEMA = 'significant-content-reels/v1';

export function normalizeSignificantReelsEnvelope(input) {
  objectOrThrow(input, 'handoff envelope');
  if (input.schema !== SIGNIFICANT_REELS_SCHEMA) {
    throw new Error(`unsupported Significant Content reel schema: ${input.schema ?? 'missing'}`);
  }
  const packageId = stringOrThrow(input.packageId, 'packageId');
  const packageRevision = positiveInteger(input.packageRevision, 'packageRevision');
  const sourceUrl = absoluteUrlOrThrow(input.sourceUrl, 'sourceUrl');
  const destinationUrl = absoluteUrlOrThrow(input.destinationUrl, 'destinationUrl');
  const variants = arrayOrThrow(input.variants, 'variants')
    .map((variant, index) => normalizeApprovedVariant(variant, index, destinationUrl));
  if (!variants.length) throw new Error('variants must contain at least one approved variant');
  if (new Set(variants.map((variant) => variant.id)).size !== variants.length) {
    throw new Error('variant ids must be unique');
  }
  return deepFreeze({
    schema: SIGNIFICANT_REELS_SCHEMA,
    packageId,
    packageRevision,
    sourceUrl,
    destinationUrl,
    exportedAt: isoOrThrow(input.exportedAt, 'exportedAt'),
    variants,
  });
}

export function normalizeApprovedVariant(input, index = 0, envelopeDestinationUrl) {
  objectOrThrow(input, `variants[${index}]`);
  if (input.status !== 'approved') throw new Error(`variants[${index}].status must be approved`);
  const targetDurationSeconds = durationOrThrow(
    input.targetDurationSeconds ?? input.targetDuration,
    `variants[${index}].targetDurationSeconds`,
  );
  const hook = stringOrThrow(input.hook, `variants[${index}].hook`);
  const payoff = stringOrThrow(input.payoff, `variants[${index}].payoff`);
  const scenes = arrayOrThrow(input.scenes, `variants[${index}].scenes`)
    .map((scene, sceneIndex) => normalizeScene(scene, index, sceneIndex));
  if (!scenes.length) throw new Error(`variants[${index}].scenes must not be empty`);
  if (scenes[0].narration !== hook) {
    throw new Error(`variants[${index}] first scene narration must equal the approved hook`);
  }
  if (scenes[0].durationSeconds > 1.5) {
    throw new Error(`variants[${index}] first scene must be at most 1.5 seconds`);
  }
  if (!scenes.some((scene) => scene.narration.includes(payoff))) {
    throw new Error(`variants[${index}] payoff must appear in a scene narration`);
  }
  const destinationUrl = absoluteUrlOrThrow(input.destinationUrl, `variants[${index}].destinationUrl`);
  if (destinationUrl !== envelopeDestinationUrl) {
    throw new Error(`variants[${index}].destinationUrl must match envelope destinationUrl`);
  }
  return deepFreeze({
    id: stringOrThrow(input.id, `variants[${index}].id`),
    status: 'approved',
    format: stringOrThrow(input.format, `variants[${index}].format`),
    hypothesis: stringOrThrow(input.hypothesis, `variants[${index}].hypothesis`),
    hook,
    payoff,
    targetDurationSeconds,
    scenes,
    visualDirection: stringOrThrow(input.visualDirection, `variants[${index}].visualDirection`),
    caption: stringOrThrow(input.caption, `variants[${index}].caption`),
    cta: stringOrThrow(input.cta, `variants[${index}].cta`),
    tags: stringArrayOrThrow(input.tags, `variants[${index}].tags`),
    destinationUrl,
    provenance: normalizeProvenance(input.provenance, index),
  });
}

export async function importSignificantReels(input, options = {}) {
  const envelope = normalizeSignificantReelsEnvelope(input);
  const store = options.store ?? new IdeaStore(options.storeOptions);
  const existingIdeas = await store.listIdeas();
  const results = [];
  for (const variant of envelope.variants) {
    const idempotencyKey = contentVariantKey(envelope.packageId, envelope.packageRevision, variant.id);
    const exact = existingIdeas.find((idea) => idea.idempotencyKey === idempotencyKey);
    if (exact) {
      results.push({ idea: exact, created: false, reason: 'duplicate_import' });
      continue;
    }
    const fingerprint = approvedVariantFingerprint(variant);
    const unchanged = existingIdeas.find((idea) => (
      idea.contentSource?.packageId === envelope.packageId
      && idea.contentSource?.variantId === variant.id
      && idea.contentSource?.variantFingerprint === fingerprint
    ));
    if (unchanged) {
      results.push({ idea: unchanged, created: false, reason: 'unchanged_revision' });
      continue;
    }
    const contentSource = {
      schema: SIGNIFICANT_REELS_SCHEMA,
      packageId: envelope.packageId,
      packageRevision: envelope.packageRevision,
      variantId: variant.id,
      sourceUrl: envelope.sourceUrl,
      destinationUrl: envelope.destinationUrl,
      exportedAt: envelope.exportedAt,
      idempotencyKey,
      variantFingerprint: fingerprint,
    };
    const idea = await store.saveIdea({
      id: `significant_${createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)}`,
      title: variant.caption,
      niche: 'significant-hobbies',
      angle: variant.hypothesis,
      hook: variant.hook,
      format: variant.format,
      notes: null,
      status: 'new',
      idempotencyKey,
      contentSource,
      approvedVariant: variant,
    });
    existingIdeas.push(idea);
    results.push({ idea, created: true, reason: 'imported' });
  }
  return {
    schema: 'significant-content-import-result/v1',
    packageId: envelope.packageId,
    packageRevision: envelope.packageRevision,
    imported: results.filter((result) => result.created).length,
    existing: results.filter((result) => !result.created).length,
    results,
  };
}

export function importedVariantToScript(idea) {
  assertImportedIdea(idea);
  const variant = idea.approvedVariant;
  return deepFreeze({
    source: 'significant-content-approved-variant',
    topic: idea.title,
    voice: undefined,
    targetDurationSeconds: variant.targetDurationSeconds,
    wordBudget: variant.scenes.reduce((total, scene) => total + scene.narration.split(/\s+/).length, 0),
    hook: variant.hook,
    payoff: variant.payoff,
    scenes: variant.scenes.map((scene, index) => ({
      label: scene.label ?? (index === 0 ? 'hook' : `scene_${index + 1}`),
      narration: scene.narration,
      brollQuery: scene.visual,
      onScreenText: scene.onScreenText,
      durationSeconds: scene.durationSeconds,
    })),
    hashtags: variant.tags.map((tag) => tag.startsWith('#') ? tag : `#${tag.replace(/\s+/g, '')}`),
  });
}

export function importedVariantToVideoBrief(idea, options = {}) {
  const script = importedVariantToScript(idea);
  const variant = idea.approvedVariant;
  const source = idea.contentSource;
  return normalizeVideoBrief({
    id: `significant-${slug(source.packageId)}-r${source.packageRevision}-${slug(source.variantId)}`,
    projectSlug: 'significanthobbies',
    channel: options.channel ?? 'youtube_shorts',
    title: idea.title,
    hook: variant.hook,
    body: [
      `Script: ${script.scenes.map((scene) => scene.narration).join(' ')}`,
      'Scene plan (shot list):',
      ...script.scenes.map((scene, index) => `${index + 1}. (${scene.durationSeconds}s) Narration: ${scene.narration} Visual: ${scene.brollQuery} Caption: ${scene.onScreenText ?? 'none'}`),
      `Captions: ${variant.caption}`,
      `Asset prompts: ${variant.visualDirection}`,
      `Approved payoff: ${variant.payoff}`,
      `Source package: ${source.packageId} revision ${source.packageRevision}, variant ${source.variantId}.`,
    ].join('\n'),
    cta: variant.cta,
    audience: variant.provenance.audience ?? undefined,
    productUrl: variant.destinationUrl,
    proofUrl: source.sourceUrl,
    proofType: 'product_artifact',
    template: options.template,
    renderMode: options.engine ?? 'mock',
    durationSeconds: variant.targetDurationSeconds,
  });
}

export async function runImportedVariantWorkflow({
  idea,
  store,
  engine = 'mock',
  outputDir = './tmp/studio/significant-content',
  rendererOptions = {},
  assessQuality = assessRender,
  now = () => new Date(),
} = {}) {
  assertImportedIdea(idea);
  const script = importedVariantToScript(idea);
  const brief = importedVariantToVideoBrief(idea, { engine });
  const dir = path.resolve(outputDir, slug(idea.contentSource.idempotencyKey));
  await mkdir(dir, { recursive: true });
  await writeJson(path.join(dir, 'script.json'), script);
  await writeJson(path.join(dir, 'brief.json'), brief);
  await writeJson(path.join(dir, 'source.json'), {
    contentSource: idea.contentSource,
    approvedVariant: idea.approvedVariant,
  });
  const renderer = rendererOptions.renderer ?? createRenderer(engine, rendererOptions);
  const render = await renderer.createVideo(brief, { variantId: idea.contentSource.variantId });
  await writeJson(path.join(dir, 'render.json'), render);
  const quality = await assessQuality({ script, videoPath: render.videos?.[0] ?? null });
  await writeJson(path.join(dir, 'quality.json'), quality);
  const ideaStore = store ?? new IdeaStore();
  await ideaStore.updateIdea(idea.id, { status: 'rendered', notes: `artifacts: ${dir}` });
  return {
    ideaId: idea.id,
    artifactDir: dir,
    video: render.videos?.[0] ?? null,
    render,
    quality,
    brief,
    script,
    renderedAt: now().toISOString(),
  };
}

export function contentVariantKey(packageId, packageRevision, variantId) {
  return `${stringOrThrow(packageId, 'packageId')}:${positiveInteger(packageRevision, 'packageRevision')}:${stringOrThrow(variantId, 'variantId')}`;
}

export function approvedVariantFingerprint(variant) {
  return createHash('sha256').update(stableJson(variant)).digest('hex');
}

function normalizeScene(input, variantIndex, sceneIndex) {
  objectOrThrow(input, `variants[${variantIndex}].scenes[${sceneIndex}]`);
  return {
    label: optionalString(input.label) ?? (sceneIndex === 0 ? 'hook' : `scene_${sceneIndex + 1}`),
    narration: stringOrThrow(input.narration, `variants[${variantIndex}].scenes[${sceneIndex}].narration`),
    visual: stringOrThrow(input.visual ?? input.visualDirection, `variants[${variantIndex}].scenes[${sceneIndex}].visual`),
    onScreenText: optionalString(input.onScreenText) ?? null,
    durationSeconds: positiveNumber(input.durationSeconds, `variants[${variantIndex}].scenes[${sceneIndex}].durationSeconds`),
  };
}

function normalizeProvenance(input, index) {
  objectOrThrow(input, `variants[${index}].provenance`);
  return {
    sourceIds: stringArrayOrThrow(input.sourceIds, `variants[${index}].provenance.sourceIds`),
    sourceUrls: arrayOrThrow(input.sourceUrls, `variants[${index}].provenance.sourceUrls`)
      .map((url, urlIndex) => absoluteUrlOrThrow(url, `variants[${index}].provenance.sourceUrls[${urlIndex}]`)),
    generatedAt: isoOrThrow(input.generatedAt, `variants[${index}].provenance.generatedAt`),
    approvedAt: isoOrThrow(input.approvedAt, `variants[${index}].provenance.approvedAt`),
    approvedBy: stringOrThrow(input.approvedBy, `variants[${index}].provenance.approvedBy`),
    audience: optionalString(input.audience) ?? null,
  };
}

function assertImportedIdea(idea) {
  if (!idea?.contentSource || !idea?.approvedVariant) throw new Error('idea is not an imported Significant Content variant');
  if (idea.contentSource.schema !== SIGNIFICANT_REELS_SCHEMA) throw new Error('idea has unsupported source schema');
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'variant';
}
function objectOrThrow(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value;
}
function arrayOrThrow(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}
function stringArrayOrThrow(value, field) {
  const list = arrayOrThrow(value, field).map((entry, index) => stringOrThrow(entry, `${field}[${index}]`));
  if (!list.length) throw new Error(`${field} must not be empty`);
  return list;
}
function stringOrThrow(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${field} must be a positive integer`);
  return number;
}
function positiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${field} must be a positive number`);
  return number;
}
function durationOrThrow(value, field) {
  const number = positiveNumber(value, field);
  if (number < 5 || number > 90) throw new Error(`${field} must be between 5 and 90`);
  return number;
}
function isoOrThrow(value, field) {
  const text = stringOrThrow(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`${field} must be an ISO date`);
  return new Date(text).toISOString();
}
function absoluteUrlOrThrow(value, field) {
  const text = stringOrThrow(value, field);
  let url;
  try { url = new URL(text); } catch { throw new Error(`${field} must be an absolute URL`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${field} must use http or https`);
  return url.toString();
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
