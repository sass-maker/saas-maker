#!/usr/bin/env node
/**
 * Pull accepted reel-channel marketing posts from SaaS Maker and create
 * corresponding reel drafts on the reel-pipeline worker. Idempotent: posts
 * already mirrored as reels (matched via the `marketingPostId` field on the
 * brief) are skipped.
 *
 * Run this once, or on a schedule (cron, scheduled GitHub Action, etc.).
 *
 * Usage:
 *   node scripts/sync-from-saasmaker.js
 *
 * Env:
 *   SAASMAKER_SESSION_TOKEN   required
 *   REEL_INTERNAL_TOKEN       required for deployed Worker routes
 *   SAASMAKER_API_URL         optional, defaults to client default
 *   REEL_WORKER_URL           optional, defaults to deployed worker
 *   REEL_PIPELINE_LIMIT       optional, default 20
 *   REEL_PIPELINE_PROJECT     optional, restrict to one projectSlug
 *   REEL_PIPELINE_CHANNEL     optional, restrict to one reel channel
 */
import { SaaSMakerClient } from '../src/saas-maker-client.js';
import { reelWorkerHeaders } from '../src/reel-worker-auth.js';

const WORKER = process.env.REEL_WORKER_URL ?? 'https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev';
const WORKER_HEADERS = reelWorkerHeaders();
const WORKER_JSON_HEADERS = reelWorkerHeaders({ 'content-type': 'application/json' });
const LIMIT = Number(process.env.REEL_PIPELINE_LIMIT ?? 20);
const REEL_CHANNELS = new Set(['tiktok', 'instagram_reels', 'youtube_shorts']);

if (!process.env.SAASMAKER_SESSION_TOKEN) {
  console.error('Missing SAASMAKER_SESSION_TOKEN env. Aborting.');
  process.exit(2);
}

const client = new SaaSMakerClient({});

console.log('▸ Fetching existing reel records from worker…');
const existing = await fetchAllReels();
const mirroredPostIds = new Set();
for (const reel of existing) {
  const postId = reel.brief?.marketingPostId;
  if (postId) mirroredPostIds.add(postId);
}
console.log(`  ${existing.length} existing reels, ${mirroredPostIds.size} already mirrored from SaaS Maker`);

console.log('▸ Fetching accepted SaaS Maker marketing posts…');
const filters = { status: 'accepted', limit: LIMIT };
if (process.env.REEL_PIPELINE_PROJECT) filters.project_slug = process.env.REEL_PIPELINE_PROJECT;
if (process.env.REEL_PIPELINE_CHANNEL) filters.channel = process.env.REEL_PIPELINE_CHANNEL;
const posts = await client.listMarketingPosts(filters);
const reelPosts = posts.filter((post) => REEL_CHANNELS.has(post.channel));
console.log(`  ${posts.length} accepted total, ${reelPosts.length} are reel channels`);

let created = 0;
let skippedExisting = 0;
let skippedRendered = 0;
let failed = 0;

for (const post of reelPosts) {
  if (mirroredPostIds.has(post.id)) { skippedExisting += 1; continue; }
  if (post.asset_url || post.result_url) { skippedRendered += 1; continue; }

  const reelInput = buildReelInput(post);
  try {
    const res = await fetch(`${WORKER}/reels`, {
      method: 'POST',
      headers: WORKER_JSON_HEADERS,
      body: JSON.stringify(reelInput),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`worker POST /reels ${res.status}: ${body.slice(0, 200)}`);
    }
    const payload = await res.json();
    created += 1;
    console.log(`  ✓ ${post.id} → ${payload.data.id} (${payload.data.title})`);
  } catch (error) {
    failed += 1;
    console.warn(`  × ${post.id} failed: ${error.message}`);
  }
}

console.log(`\nSummary: created=${created} skipped(existing)=${skippedExisting} skipped(rendered)=${skippedRendered} failed=${failed}`);

function buildReelInput(post) {
  // Map SaaS Maker post fields onto the worker's POST /reels schema.
  // marketingPostId is the idempotency key that prevents double-creating on
  // re-runs. The worker's createReelDraft normalizes this into a video brief.
  return {
    id: `sm-${post.id}`,
    projectSlug: post.project_slug,
    projectId: post.project_id ?? post.project_slug,
    channel: post.channel,
    goal: post.title ?? post.hook ?? 'show the product',
    audience: post.audience ?? undefined,
    hook: post.hook ?? post.title,
    body: post.body,
    cta: post.cta,
    productUrl: post.product_url ?? post.productUrl,
    marketingPostId: post.id,
    taskId: post.task_id ?? post.taskId,
    source: 'saas-maker-sync',
    realDetails: { source: 'saas-maker', postId: post.id },
  };
}

async function fetchAllReels() {
  const statuses = ['generated', 'approved', 'rendering', 'video_ready', 'needs_review', 'ready_to_post', 'video_rejected', 'rejected', 'posted'];
  const seen = new Map();
  for (const status of statuses) {
    try {
      const res = await fetch(`${WORKER}/reels?status=${status}`, {
        headers: WORKER_HEADERS,
      });
      if (!res.ok) continue;
      const payload = await res.json();
      for (const reel of (payload.data || [])) {
        if (!seen.has(reel.id)) seen.set(reel.id, reel);
      }
    } catch (error) {
      console.warn(`  ! failed to fetch ${status}: ${error.message}`);
    }
  }
  return Array.from(seen.values());
}
