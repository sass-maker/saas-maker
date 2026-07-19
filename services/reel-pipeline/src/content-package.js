import brandConfig from '../config/brand-channels.json' with { type: 'json' };

import { normalizeVideoBrief } from './video-brief.js';

export const CONTENT_PACKAGE_SCHEMA = 'fleet.content-package.v1';
const APPROVAL_STATES = new Set(['proposed', 'approved', 'rejected']);
const VARIANT_STATES = new Set(['proposed', 'approved', 'rejected']);
const VIDEO_CHANNELS = new Set(['instagram_reels', 'youtube_shorts', 'tiktok']);

export function getBrandProfile(slug) {
  const profile = brandConfig.brands?.[slug];
  if (!profile) throw new Error(`unknown brand: ${slug}`);
  return structuredClone(profile);
}

export function normalizeContentPackage(input) {
  if (!input || typeof input !== 'object') throw new Error('content package must be an object');
  if (input.schema !== CONTENT_PACKAGE_SCHEMA) {
    throw new Error(`unsupported content package schema: ${input.schema ?? 'missing'}`);
  }
  const brandSlug = stringOrThrow(input.brand?.slug, 'brand.slug');
  const brand = { slug: brandSlug, ...getBrandProfile(brandSlug), ...input.brand };
  const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 1) throw new Error('revision must be a positive integer');

  const claims = arrayOrThrow(input.topic?.claims, 'topic.claims').map((claim, index) => ({
    text: stringOrThrow(claim?.text, `topic.claims[${index}].text`),
    evidenceUrls: normalizeUrls(claim?.evidenceUrls, `topic.claims[${index}].evidenceUrls`),
  }));
  if (!claims.length) throw new Error('topic.claims must contain at least one claim');

  const approvalStatus = stringOrThrow(input.approval?.status, 'approval.status');
  if (!APPROVAL_STATES.has(approvalStatus)) throw new Error(`unsupported approval status: ${approvalStatus}`);
  const variants = arrayOrThrow(input.variants, 'variants').map((variant, index) => normalizeVariant(variant, index, brand));
  if (!variants.length) throw new Error('variants must contain at least one channel variant');
  const ids = variants.map((variant) => variant.id);
  if (new Set(ids).size !== ids.length) throw new Error('variant ids must be unique');

  return {
    schema: CONTENT_PACKAGE_SCHEMA,
    id: stringOrThrow(input.id, 'id'),
    revision,
    createdAt: isoOrThrow(input.createdAt, 'createdAt'),
    brand,
    source: {
      adapter: stringOrThrow(input.source?.adapter, 'source.adapter'),
      sourceId: stringOrThrow(input.source?.sourceId, 'source.sourceId'),
      canonicalUrl: absoluteUrlOrThrow(input.source?.canonicalUrl, 'source.canonicalUrl'),
      generatedAt: isoOrThrow(input.source?.generatedAt, 'source.generatedAt'),
    },
    topic: {
      title: stringOrThrow(input.topic?.title, 'topic.title'),
      summary: stringOrThrow(input.topic?.summary, 'topic.summary'),
      audience: optionalString(input.topic?.audience),
      destinationUrl: absoluteUrlOrThrow(input.topic?.destinationUrl, 'topic.destinationUrl'),
      claims,
    },
    approval: {
      status: approvalStatus,
      approvedAt: input.approval?.approvedAt ? isoOrThrow(input.approval.approvedAt, 'approval.approvedAt') : null,
      approvedBy: optionalString(input.approval?.approvedBy) ?? null,
    },
    variants,
  };
}

export function contentPackageToVideoBrief(input, options = {}) {
  const contentPackage = normalizeContentPackage(input);
  if (contentPackage.approval.status !== 'approved' && !options.allowProposed) {
    throw new Error('content package must be approved before media production');
  }
  const variant = options.variantId
    ? contentPackage.variants.find((entry) => entry.id === options.variantId)
    : contentPackage.variants[0];
  if (!variant) throw new Error(`variant not found: ${options.variantId}`);
  if (variant.status !== 'approved' && !options.allowProposed) {
    throw new Error('channel variant must be approved before media production');
  }
  return normalizeVideoBrief({
    id: `${contentPackage.id}-r${contentPackage.revision}-${variant.id}`,
    projectSlug: contentPackage.brand.slug,
    channel: variant.channel,
    title: contentPackage.topic.title,
    hook: variant.hook,
    body: [
      `Script: ${variant.script}`,
      `Shot list: ${variant.shotList.map((shot, index) => `${index + 1}. ${shot}`).join(' ')}`,
      `Captions: ${variant.captions.map((caption) => `"${caption}"`).join(' / ')}`,
      `Asset prompts: ${variant.visualDirection}`,
      `Source package: ${contentPackage.id} revision ${contentPackage.revision}.`,
    ].join('\n'),
    cta: variant.cta,
    audience: contentPackage.topic.audience,
    productUrl: contentPackage.topic.destinationUrl,
    proofUrl: contentPackage.topic.claims[0]?.evidenceUrls[0] ?? contentPackage.source.canonicalUrl,
    proofType: 'product_artifact',
    brandTone: contentPackage.brand.voice.join(', '),
    template: variant.template,
    renderMode: options.renderMode ?? 'html-composition',
    durationSeconds: variant.durationSeconds,
  });
}

export function buildProposedVariant({ id = 'vertical-proof-v1', channel = 'youtube_shorts', hook, summary, proof, cta, brandSlug, durationSeconds = 30 }) {
  const brand = getBrandProfile(brandSlug);
  return normalizeVariant({
    id,
    channel,
    status: 'proposed',
    hook,
    script: `${hook} ${summary} ${proof} ${cta}`,
    shotList: ['Immediate hook card', 'Source-backed explanation', 'Visible proof or canonical source', 'Concrete takeaway', 'Brand CTA'],
    captions: [hook, compact(proof, 90), cta],
    visualDirection: `Use ${brand.name} brand colors, large mute-friendly captions, source receipts, and real topic or product visuals. No generic AI imagery.`,
    cta,
    template: 'source_proof_takeaway',
    durationSeconds,
  }, 0, { ...brand, slug: brandSlug });
}

function normalizeVariant(variant, index, brand) {
  const channel = stringOrThrow(variant?.channel, `variants[${index}].channel`);
  if (!VIDEO_CHANNELS.has(channel)) throw new Error(`unsupported video channel: ${channel}`);
  if (!brand.channels.includes(channel)) throw new Error(`${brand.slug ?? brand.name} is not configured for ${channel}`);
  const status = stringOrThrow(variant?.status, `variants[${index}].status`);
  if (!VARIANT_STATES.has(status)) throw new Error(`unsupported variant status: ${status}`);
  const durationSeconds = Number(variant?.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 10 || durationSeconds > 90) {
    throw new Error(`variants[${index}].durationSeconds must be between 10 and 90`);
  }
  return {
    id: stringOrThrow(variant?.id, `variants[${index}].id`),
    channel,
    status,
    hook: stringOrThrow(variant?.hook, `variants[${index}].hook`),
    script: stringOrThrow(variant?.script, `variants[${index}].script`),
    shotList: stringArrayOrThrow(variant?.shotList, `variants[${index}].shotList`),
    captions: stringArrayOrThrow(variant?.captions, `variants[${index}].captions`),
    visualDirection: stringOrThrow(variant?.visualDirection, `variants[${index}].visualDirection`),
    cta: stringOrThrow(variant?.cta, `variants[${index}].cta`),
    template: optionalString(variant?.template) ?? 'source_proof_takeaway',
    durationSeconds,
  };
}

function normalizeUrls(value, field) {
  const list = arrayOrThrow(value, field).map((entry, index) => absoluteUrlOrThrow(entry, `${field}[${index}]`));
  if (!list.length) throw new Error(`${field} must contain at least one URL`);
  return [...new Set(list)];
}
function stringArrayOrThrow(value, field) {
  const list = arrayOrThrow(value, field).map((entry, index) => stringOrThrow(entry, `${field}[${index}]`));
  if (!list.length) throw new Error(`${field} must not be empty`);
  return list;
}
function arrayOrThrow(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}
function absoluteUrlOrThrow(value, field) {
  const text = stringOrThrow(value, field);
  let url;
  try { url = new URL(text); } catch { throw new Error(`${field} must be an absolute URL`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${field} must use http or https`);
  return url.toString();
}
function isoOrThrow(value, field) {
  const text = stringOrThrow(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`${field} must be an ISO date`);
  return new Date(text).toISOString();
}
function stringOrThrow(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function compact(value, limit) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`;
}
