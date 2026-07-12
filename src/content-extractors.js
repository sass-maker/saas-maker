import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildProposedVariant, CONTENT_PACKAGE_SCHEMA, normalizeContentPackage } from './content-package.js';

export async function extractHighSignal({ fleetRoot, limit = 5, now = () => new Date() }) {
  const filePath = path.join(fleetRoot, 'high-signal', 'data', 'personal-reel-briefs.jsonl');
  const lines = (await readFile(filePath, 'utf8')).trim().split(/\n+/).filter(Boolean);
  if (!lines.length) return [];
  const latest = JSON.parse(lines.at(-1));
  return latest.reelBriefs.slice(0, limit).map((brief) => packageFromHighSignal(brief, latest.generatedAt, now));
}

export async function extractSignificantHobbies({ fleetRoot, limit = 5, now = () => new Date() }) {
  const filePath = path.join(fleetRoot, 'significanthobbies', 'src', 'lib', 'blog-posts.ts');
  const module = await import(`${pathToFileURL(filePath).href}?updated=${Date.now()}`);
  return module.blogPosts.slice(-limit).reverse().map((post) => packageFromHobbyPost(post, now));
}

export async function extractSweInterviewPrep({ fleetRoot, limit = 5, now = () => new Date(), catalogPath }) {
  const filePath = catalogPath ?? path.join(fleetRoot, 'swe-interview-prep', 'src', 'data', 'learning-sources.json');
  const catalog = JSON.parse(await readFile(filePath, 'utf8'));
  const candidates = catalog.items.filter((item) => item.sourceKind !== 'briefing' && item.summary && item.resources?.length);
  return candidates.slice(0, limit).map((item) => packageFromLearningItem(item, catalog.generatedAt, now));
}

export async function extractContentPackages(source, options) {
  if (source === 'high-signal') return extractHighSignal(options);
  if (source === 'significanthobbies') return extractSignificantHobbies(options);
  if (source === 'swe-interview-prep') return extractSweInterviewPrep(options);
  if (source === 'all') {
    return (await Promise.all([
      extractHighSignal(options),
      extractSignificantHobbies(options),
      extractSweInterviewPrep(options),
    ])).flat();
  }
  throw new Error(`unsupported content source: ${source}`);
}

function packageFromHighSignal(brief, generatedAt, now) {
  const evidenceUrls = brief.evidenceUrls.map((url) => absoluteEvidenceUrl(url, 'https://highsignal.app'));
  const destinationUrl = `https://highsignal.app${brief.evidenceUrls.find((url) => String(url).startsWith('/')) ?? ''}`;
  return makePackage({
    id: `high-signal:${brief.id}`,
    brandSlug: 'high-signal',
    sourceAdapter: 'high-signal-reel-briefs',
    sourceId: brief.id,
    canonicalUrl: evidenceUrls[0] ?? 'https://highsignal.app',
    generatedAt,
    title: brief.title,
    summary: brief.humanTension,
    audience: brief.humanTension,
    destinationUrl,
    claim: brief.proofBeat,
    evidenceUrls,
    hook: brief.hook,
    proof: brief.proofBeat,
    cta: brief.cta,
    now,
  });
}

function packageFromHobbyPost(post, now) {
  const canonicalUrl = `https://significanthobbies.com/blog/${post.slug}`;
  const proof = firstParagraph(post.content) ?? post.excerpt;
  return makePackage({
    id: `significanthobbies:${post.slug}`,
    brandSlug: 'significanthobbies',
    sourceAdapter: 'significant-hobbies-editorial',
    sourceId: post.slug,
    canonicalUrl,
    generatedAt: now().toISOString(),
    title: post.title,
    summary: post.excerpt,
    audience: `Adults exploring ${post.category.toLowerCase()} through meaningful hobbies`,
    destinationUrl: canonicalUrl,
    claim: proof,
    evidenceUrls: [canonicalUrl],
    hook: post.title,
    proof,
    cta: 'Pick one small hobby experiment to try this week.',
    now,
  });
}

function packageFromLearningItem(item, generatedAt, now) {
  const resourceUrls = item.resources.map((resource) => resource.url).filter((url) => /^https?:/.test(url));
  const canonicalUrl = resourceUrls[0] ?? 'https://swe-interview-prep.pages.dev/learn';
  const destinationUrl = `https://swe-interview-prep.pages.dev/sources/${encodeURIComponent(item.id)}`;
  return makePackage({
    id: `swe-interview-prep:${safeId(item.id)}`,
    brandSlug: 'swe-interview-prep',
    sourceAdapter: 'swe-learning-sources',
    sourceId: item.id,
    canonicalUrl,
    generatedAt,
    title: item.title,
    summary: item.summary,
    audience: 'Software engineers building durable technical understanding',
    destinationUrl,
    claim: item.summary,
    evidenceUrls: resourceUrls.length ? resourceUrls : [canonicalUrl],
    hook: `Can you explain ${item.title} without memorizing it?`,
    proof: item.summary,
    cta: `Learn ${item.title} in a focused session.`,
    now,
  });
}

function makePackage({ id, brandSlug, sourceAdapter, sourceId, canonicalUrl, generatedAt, title, summary, audience, destinationUrl, claim, evidenceUrls, hook, proof, cta, now }) {
  return normalizeContentPackage({
    schema: CONTENT_PACKAGE_SCHEMA,
    id,
    revision: 1,
    createdAt: now().toISOString(),
    brand: { slug: brandSlug },
    source: { adapter: sourceAdapter, sourceId, canonicalUrl, generatedAt },
    topic: { title, summary, audience, destinationUrl, claims: [{ text: claim, evidenceUrls }] },
    approval: { status: 'proposed', approvedAt: null, approvedBy: null },
    variants: [buildProposedVariant({ hook, summary, proof, cta, brandSlug })],
  });
}

function firstParagraph(blocks) {
  return blocks.find((block) => block.type === 'paragraph' && block.text?.trim())?.text;
}
function absoluteEvidenceUrl(value, base) {
  return new URL(value, base).toString();
}
function safeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}
