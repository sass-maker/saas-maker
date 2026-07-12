import { execFile } from 'node:child_process';
import { mkdir, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { publishRenderArtifacts } from './artifact-publisher.js';
import { getBrandProfile, normalizeContentPackage } from './content-package.js';
import { extractContentPackages } from './content-extractors.js';
import { buildDistributionRequest, executeDistribution } from './distribution.js';
import { buildDistributionEnvelope, parseDistributionEnvelope, upsertDistributionEnvelope } from './distribution-envelope.js';
import { renderBrandContentPackage } from './adapters/brand-video.js';
import { loadSocialAccountsConfig } from './config/social-accounts.js';
import { FilePublicationLedger } from './publication-ledger.js';
import { classifyPostingError, createPostingProvider } from './posting.js';
import { createSaaSMakerClient } from './saas-maker-client.js';

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACTIVE_CHANNELS = new Set(['instagram_reels', 'youtube_shorts']);

export async function enqueueContentPackages(packages, options = {}) {
  const client = createSaaSMakerClient({ client: options.client, ...options.saasMaker });
  const existing = await client.listMarketingPosts({ limit: 500 });
  const results = [];
  for (const input of packages) {
    const contentPackage = normalizeContentPackage(input);
    for (const variant of contentPackage.variants.filter((entry) => ACTIVE_CHANNELS.has(entry.channel))) {
      const sourceId = sourceIdFor(contentPackage, variant.id);
      const duplicate = existing.find((post) => post.source_id === sourceId && post.channel === variant.channel);
      if (duplicate) {
        results.push({ sourceId, skipped: true, reason: 'already queued', postId: duplicate.id });
        continue;
      }
      const envelope = buildDistributionEnvelope(contentPackage);
      const post = await client.createMarketingPost({
        project_slug: contentPackage.brand.slug,
        channel: variant.channel,
        status: 'generated',
        title: contentPackage.topic.title,
        hook: variant.hook,
        body: variant.script,
        cta: variant.cta,
        source_type: 'manual',
        source_id: sourceId,
        notes: upsertDistributionEnvelope('Source-backed Fleet content package. Accept to approve media production.', envelope),
      });
      results.push({ sourceId, skipped: false, postId: post.id });
      existing.push(post);
    }
  }
  return results;
}

export async function syncSourceContent(options = {}) {
  const syncLock = options.syncLock ?? path.join(process.env.HOME ?? '.', 'Library/Application Support/Fleet Ops/marketing/source-sync.lock');
  try {
    await mkdir(syncLock, { recursive: false });
  } catch (error) {
    if (error.code === 'EEXIST') return { skipped: true, reason: 'source sync already running', extracted: 0, results: [] };
    throw error;
  }
  try {
    const client = createSaaSMakerClient({ client: options.client, ...options.saasMaker });
    const existing = await client.listMarketingPosts({ limit: 500 });
    const pending = existing.filter((post) => {
      if (!['generated', 'accepted'].includes(post.status)) return false;
      try {
        return Boolean(parseDistributionEnvelope(post.notes)?.publicationReceipt === null);
      } catch {
        return true;
      }
    });
    const maxPending = options.maxPending ?? 12;
    if (pending.length >= maxPending) return { skipped: true, reason: `review backlog ${pending.length}/${maxPending}`, extracted: 0, results: [] };
    const fleetRoot = options.fleetRoot ?? path.resolve(REPO_ROOT, '..');
    const catalogPath = options.catalogPath ?? path.join(process.env.HOME ?? '.', 'Library/Application Support/Fleet Ops/learning-sync/swe-interview-prep/src/data/learning-sources.json');
    const packages = await extractContentPackages(options.source ?? 'all', { fleetRoot, catalogPath, limit: options.limit ?? 1 });
    const results = await enqueueContentPackages(packages, { client });
    return { skipped: false, extracted: packages.length, results };
  } finally {
    await rmdir(syncLock).catch(() => {});
  }
}

export async function renderApprovedContent(options = {}) {
  const client = createSaaSMakerClient({ client: options.client, ...options.saasMaker });
  const posts = await client.listMarketingPosts({ status: 'accepted', limit: options.limit ?? 20 });
  const results = [];
  for (const post of posts) {
    let envelope;
    try { envelope = parseDistributionEnvelope(post.notes); } catch (error) {
      results.push({ postId: post.id, skipped: true, reason: error.message });
      continue;
    }
    if (!envelope || envelope.mediaReceipt || !ACTIVE_CHANNELS.has(post.channel)) continue;
    try {
      const approved = approvePackageForPost(envelope.contentPackage, post, options);
      const renderer = options.renderer ?? renderBrandContentPackage;
      const rendered = await renderer(approved, { variantId: variantForPost(approved, post).id, artifactDir: options.artifactDir });
      const receipt = await publishMediaReceipt(rendered.receipt, options);
      const request = buildDistributionRequest(approved, receipt, { provider: 'native', createdAt: now(options).toISOString() });
      const updatedEnvelope = buildDistributionEnvelope(approved, { mediaReceipt: receipt, distributionRequest: request });
      const patch = {
        asset_url: receipt.publicUrl ?? receipt.artifact,
        result_url: receipt.publicUrl ?? receipt.artifact,
        notes: upsertDistributionEnvelope(post.notes, updatedEnvelope),
      };
      await client.updateMarketingPost(post.id, patch);
      await notify(options, 'success', approved.brand.slug, 'Video ready for posting approval', `${approved.topic.title} is rendered for ${post.channel}.`, null, `marketing:rendered:${post.id}`);
      results.push({ postId: post.id, status: 'rendered', receipt });
    } catch (error) {
      await notify(options, 'warning', post.project_slug, 'Marketing render failed', error.message, null, `marketing:render-failed:${post.id}`);
      results.push({ postId: post.id, status: 'failed', error: error.message });
    }
  }
  return { scanned: posts.length, results };
}

export async function runScheduledDistributions(options = {}) {
  const client = createSaaSMakerClient({ client: options.client, ...options.saasMaker });
  const ledger = options.ledger ?? new FilePublicationLedger({ now: () => now(options) });
  const posts = await client.listMarketingPosts({ status: 'accepted', limit: options.limit ?? 50 });
  const results = [];
  for (const post of posts) {
    let envelope;
    try { envelope = parseDistributionEnvelope(post.notes); } catch (error) {
      results.push({ postId: post.id, skipped: true, reason: error.message });
      continue;
    }
    const gate = distributionGate(post, envelope, now(options));
    if (!gate.ready) {
      if (envelope) results.push({ postId: post.id, skipped: true, reason: gate.reason });
      continue;
    }
    const claim = await ledger.claim(envelope.idempotencyKey);
    if (!claim.claimed) {
      if (claim.record.state === 'retry_wait' && Date.parse(claim.record.nextAttemptAt) <= now(options).getTime()) {
        await ledger.releaseRetry(envelope.idempotencyKey);
      } else {
        results.push({ postId: post.id, skipped: true, reason: `publication ledger is ${claim.record.state}` });
        continue;
      }
    }
    const attemptAt = now(options).toISOString();
    envelope.attempts = { ...envelope.attempts, count: envelope.attempts.count + 1, state: 'inflight', lastAttemptAt: attemptAt, nextAttemptAt: null, lastError: null };
    await client.updateMarketingPost(post.id, { notes: upsertDistributionEnvelope(post.notes, envelope) });
    try {
      const provider = options.providerFactory
        ? await options.providerFactory(post, envelope)
        : await nativeProviderFor(post.channel, options);
      const receipt = await executeDistribution(envelope.contentPackage, envelope.mediaReceipt, envelope.distributionRequest, { nativeProvider: provider, now: () => now(options) });
      envelope.publicationReceipt = receipt;
      envelope.attempts = { ...envelope.attempts, state: 'posted' };
      await ledger.complete(envelope.idempotencyKey, receipt);
      await client.updateMarketingPost(post.id, publicationPatch(post, envelope, receipt));
      await notify(options, 'success', post.project_slug, 'Marketing post released', `${post.title} was ${receipt.status} on ${post.channel}.`, receipt.externalUrl, `marketing:posted:${post.id}`);
      results.push({ postId: post.id, status: receipt.status, receipt });
    } catch (error) {
      const failure = classifyPostingError(error);
      const exhausted = envelope.attempts.count >= (options.maxAttempts ?? 5);
      const retryable = failure.retryable && !exhausted;
      const nextAttemptAt = retryable ? new Date(now(options).getTime() + retryDelayMs(envelope.attempts.count)).toISOString() : null;
      envelope.attempts = { ...envelope.attempts, state: retryable ? 'retry_wait' : 'failed', nextAttemptAt, lastError: failure.message };
      if (retryable) await ledger.retry(envelope.idempotencyKey, failure, nextAttemptAt);
      else await ledger.fail(envelope.idempotencyKey, failure);
      await client.updateMarketingPost(post.id, { notes: upsertDistributionEnvelope(post.notes, envelope) });
      await notify(options, retryable ? 'warning' : 'critical', post.project_slug, retryable ? 'Marketing post will retry' : 'Marketing post needs attention', failure.message, null, `marketing:post-failed:${post.id}:${envelope.attempts.count}`);
      results.push({ postId: post.id, status: 'failed', retryable, nextAttemptAt, failure });
    }
  }
  return { scanned: posts.length, results };
}

export function distributionGate(post, envelope, currentTime = new Date()) {
  if (!envelope) return { ready: false, reason: 'missing distribution envelope' };
  if (!envelope.mediaReceipt || !envelope.distributionRequest) return { ready: false, reason: 'media not ready' };
  if (envelope.distributionRequest.approval.status !== 'approved') return { ready: false, reason: 'distribution not approved' };
  if (envelope.publicationReceipt) return { ready: false, reason: 'already released' };
  if (envelope.attempts.state === 'inflight' || envelope.attempts.state === 'failed') return { ready: false, reason: `attempt state is ${envelope.attempts.state}` };
  if (envelope.attempts.nextAttemptAt && Date.parse(envelope.attempts.nextAttemptAt) > currentTime.getTime()) return { ready: false, reason: 'retry scheduled for later' };
  const scheduledFor = envelope.distributionRequest.scheduledFor;
  if (!scheduledFor) return { ready: false, reason: 'not scheduled' };
  if (Date.parse(scheduledFor) > currentTime.getTime()) return { ready: false, reason: 'scheduled for later' };
  if (!post.result_url && !post.asset_url) return { ready: false, reason: 'missing public artifact' };
  return { ready: true };
}

function approvePackageForPost(input, post, options) {
  const contentPackage = structuredClone(normalizeContentPackage(input));
  const approvedAt = now(options).toISOString();
  contentPackage.approval = { status: 'approved', approvedAt, approvedBy: options.approvedBy ?? 'saas-maker-cockpit' };
  const variant = variantForPost(contentPackage, post);
  variant.status = 'approved';
  return normalizeContentPackage(contentPackage);
}

function variantForPost(contentPackage, post) {
  const variantId = post.source_id?.split(':r').at(-1)?.split(':').slice(1).join(':');
  const variant = contentPackage.variants.find((entry) => entry.id === variantId && entry.channel === post.channel)
    ?? contentPackage.variants.find((entry) => entry.channel === post.channel);
  if (!variant) throw new Error(`content package has no variant for ${post.channel}`);
  return variant;
}

async function publishMediaReceipt(receipt, options) {
  if (options.publishArtifact) return options.publishArtifact(receipt);
  const published = await publishRenderArtifacts({ videos: [receipt.artifact] }, {
    r2Bucket: 'reel-artifacts',
    baseUrl: 'https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev/reels',
    ...options.artifacts,
  });
  const publicUrl = published.videos?.[0];
  if (!publicUrl || !/^https:\/\//.test(publicUrl)) throw new Error('artifact publisher did not return a public HTTPS URL');
  return { ...receipt, publicUrl };
}

async function nativeProviderFor(channel, options) {
  const accounts = options.accounts ?? await loadSocialAccountsConfig({ path: options.accountsPath });
  if (channel === 'youtube_shorts') return createPostingProvider('youtube', { youtube: { accounts: accounts.youtube } });
  if (channel === 'instagram_reels') return createPostingProvider('instagram', { instagram: { accounts: accounts.instagram } });
  throw new Error(`unsupported active channel: ${channel}`);
}

function publicationPatch(post, envelope, receipt) {
  return {
    status: receipt.status === 'posted' ? 'sent' : 'accepted',
    posted_at: receipt.status === 'posted' ? receipt.recordedAt : null,
    scheduled_for: envelope.distributionRequest.scheduledFor,
    result_url: receipt.externalUrl ?? post.result_url ?? post.asset_url,
    notes: upsertDistributionEnvelope(post.notes, envelope),
  };
}

async function notify(options, severity, project, title, body, url, dedupeKey) {
  if (options.notifier) return options.notifier({ severity, project, title, body, url, dedupeKey });
  const command = path.resolve(REPO_ROOT, '../fleet-ops/scripts/agent-bin/fleet-notify');
  const args = ['emit', '--severity', severity, '--source', 'reel-pipeline', '--project', project ?? 'reel-pipeline', '--title', title, '--body', body, '--dedupe-key', dedupeKey];
  if (url) args.push('--url', url);
  try { await execFileAsync(command, args, { timeout: 15_000 }); } catch {}
}

function sourceIdFor(contentPackage, variantId) { return `${contentPackage.id}:r${contentPackage.revision}:${variantId}`; }
function retryDelayMs(attempt) { return Math.min(6 * 60 * 60_000, 5 * 60_000 * (2 ** Math.max(0, attempt - 1))); }
function now(options) { const value = options.now ? options.now() : new Date(); return value instanceof Date ? value : new Date(value); }
