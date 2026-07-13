import { createProjectResolver } from './marketing-program.mjs';

export function buildMarketingSnapshot(posts, registry, options = {}) {
  if (!Array.isArray(posts)) throw new TypeError('posts must be an array');
  const now = new Date(options.now ?? new Date());
  if (!Number.isFinite(now.getTime())) throw new TypeError('now must be a valid date');
  const canonicalize = createProjectResolver(registry);
  const grouped = new Map(registry.projects.map((project) => [project.slug, []]));
  let unmapped = 0;
  for (const post of posts) {
    const slug = canonicalize(post?.project_slug);
    if (!grouped.has(slug)) {
      unmapped += 1;
      continue;
    }
    grouped.get(slug).push(post);
  }

  const projects = registry.projects.map((program) => summarizeProject(program, grouped.get(program.slug), now, registry.defaults.freshnessHours));
  const totals = projects.reduce((result, project) => {
    for (const stage of STAGES) result[stage] += project.stages[stage];
    result.failures += project.failures;
    result.reviewDebt += project.reviewDebt;
    return result;
  }, { foundation: 0, queued: 0, approved: 0, produced: 0, published: 0, measured: 0, failures: 0, reviewDebt: 0 });
  const receipts = posts.flatMap((post) => {
    const envelope = parseEnvelope(post?.notes);
    const receipt = envelope?.publicationReceipt;
    if (!receipt?.recordedAt && !receipt?.postedAt) return [];
    return [{ brand: canonicalize(envelope?.contentPackage?.brand?.slug ?? post.project_slug), channel: receipt.channel ?? envelope?.mediaReceipt?.channel ?? post.channel,
      provider: receipt.provider ?? 'unknown', status: receipt.status ?? 'unknown', recordedAt: receipt.recordedAt ?? receipt.postedAt }];
  }).sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt));

  return Object.freeze({
    schemaVersion: 1,
    registryVersion: registry.version,
    generatedAt: now.toISOString(),
    totals: Object.freeze({ ...totals, unmapped }),
    projects: projects.map(Object.freeze),
    lastReceipt: receipts[0] ? Object.freeze(receipts[0]) : null,
  });
}

function summarizeProject(program, posts, now, freshnessHours) {
  const enriched = posts.map((post) => ({ post, envelope: parseEnvelope(post.notes) }));
  const latestAt = latestTimestamp(posts.flatMap(activityTimestamps));
  const reviewDates = posts.filter((post) => post.status === 'generated').map((post) => timestamp(post.created_at ?? post.createdAt)).filter(Boolean);
  const oldestReviewAt = reviewDates.length ? new Date(Math.min(...reviewDates)).toISOString() : null;
  const oldestReviewAgeHours = oldestReviewAt ? roundHours(now.getTime() - Date.parse(oldestReviewAt)) : null;
  const failures = enriched.filter(({ post, envelope }) => envelope?.attempts?.state === 'failed' || noteValue(post.notes, 'posting_status') === 'error').length;
  const stages = {
    foundation: 1,
    queued: posts.filter((post) => post.status === 'generated').length,
    approved: posts.filter((post) => ['accepted', 'sent'].includes(post.status)).length,
    produced: enriched.filter(({ post, envelope }) => Boolean(envelope?.mediaReceipt || post.asset_url || post.result_url)).length,
    published: enriched.filter(({ post, envelope }) => post.status === 'sent' || Boolean(envelope?.publicationReceipt)).length,
    measured: posts.filter((post) => Boolean(noteValue(post.notes, 'metrics_synced_at'))).length,
  };
  const latestAgeHours = latestAt ? roundHours(now.getTime() - Date.parse(latestAt)) : null;
  const freshness = latestAgeHours === null ? 'empty' : latestAgeHours > freshnessHours ? 'stale' : 'fresh';
  return {
    slug: program.slug,
    mode: program.mode,
    sourceBacked: Boolean(program.contentBase),
    publicMarketing: program.publicMarketing,
    stages,
    reviewDebt: stages.queued,
    oldestReviewAt,
    oldestReviewAgeHours,
    latestActivityAt: latestAt,
    latestActivityAgeHours: latestAgeHours,
    freshness,
    failures,
    nextAction: nextAction({ program, stages, failures, freshness }),
  };
}

function nextAction({ program, stages, failures, freshness }) {
  if (failures > 0) return 'Recover failed distribution';
  if (stages.queued > 0) return 'Review generated work in SaaS Maker';
  if (stages.approved > stages.produced) return 'Produce approved media';
  if (stages.produced > stages.published) return 'Review distribution request';
  if (stages.published > stages.measured) return 'Sync publication metrics';
  if (program.mode === 'focus' && freshness !== 'fresh') return 'Propose a current focus experiment';
  if (!program.publicMarketing) return 'No public marketing action';
  return 'Monitor program freshness';
}

function parseEnvelope(notes) {
  const line = String(notes ?? '').split(/\r?\n/).find((entry) => entry.startsWith('fleet_distribution_v1:'));
  if (!line) return null;
  try { return JSON.parse(Buffer.from(line.slice('fleet_distribution_v1:'.length), 'base64url').toString('utf8')); }
  catch { return null; }
}

function noteValue(notes, key) {
  const prefix = `${key}:`;
  return String(notes ?? '').split(/\r?\n|\\n/).map((line) => line.trim()).filter((line) => line.startsWith(prefix)).map((line) => line.slice(prefix.length).trim()).filter(Boolean).at(-1) ?? null;
}

function activityTimestamps(post) {
  return [post.updated_at, post.updatedAt, post.posted_at, post.scheduled_for, post.created_at, post.createdAt].map(timestamp).filter(Boolean);
}

function timestamp(value) {
  if (!value || !Number.isFinite(Date.parse(String(value)))) return null;
  return Date.parse(String(value));
}

function latestTimestamp(values) {
  return values.length ? new Date(Math.max(...values)).toISOString() : null;
}

function roundHours(milliseconds) {
  return Math.max(0, Math.round(milliseconds / 36_000) / 100);
}

const STAGES = ['foundation', 'queued', 'approved', 'produced', 'published', 'measured'];
