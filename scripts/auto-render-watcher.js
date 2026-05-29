#!/usr/bin/env node
/**
 * Long-running daemon. Polls the reel-pipeline worker for approved-but-
 * unrendered reels and runs `scripts/render-pro.js <reelId>` for each
 * (serially — one render at a time, per the iteration-loop preference).
 *
 * Run this on a Mac that has Chrome, ffmpeg, uvx, and wrangler installed.
 *
 * Usage:
 *   node scripts/auto-render-watcher.js
 *   node scripts/auto-render-watcher.js --once   one tick then exit
 *
 * Env:
 *   REEL_WORKER_URL              optional
 *   REEL_WATCH_INTERVAL_MS       default 30000 (30s)
 *   REEL_WATCH_MAX_PER_TICK      default 1   (renders per tick; keep at 1)
 */
import { spawn } from 'node:child_process';

const WORKER = process.env.REEL_WORKER_URL ?? 'https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev';
const INTERVAL_MS = Math.max(5_000, Number(process.env.REEL_WATCH_INTERVAL_MS ?? 30_000));
const MAX_PER_TICK = Math.max(1, Number(process.env.REEL_WATCH_MAX_PER_TICK ?? 1));
const ONCE = process.argv.includes('--once');

const inFlight = new Set();
let stopRequested = false;

process.on('SIGINT', () => { console.log('\n▸ SIGINT received — finishing current render then exiting'); stopRequested = true; });
process.on('SIGTERM', () => { stopRequested = true; });

console.log(`▸ auto-render-watcher started · worker=${WORKER} · interval=${INTERVAL_MS}ms${ONCE ? ' · once' : ''}`);

while (!stopRequested) {
  try {
    await tick();
  } catch (error) {
    console.warn(`! tick error: ${error.message}`);
  }
  if (ONCE) break;
  await sleep(INTERVAL_MS);
}
console.log('▸ watcher stopped');

async function tick() {
  const reels = await fetchApproved();
  const candidates = reels.filter(needsRender).filter((reel) => !inFlight.has(reel.id));
  if (!candidates.length) {
    log('no approved+unrendered reels');
    return;
  }
  const batch = candidates.slice(0, MAX_PER_TICK);
  for (const reel of batch) {
    if (stopRequested) break;
    await renderOne(reel);
  }
}

async function fetchApproved() {
  const res = await fetch(`${WORKER}/reels?status=approved`);
  if (!res.ok) throw new Error(`worker /reels?status=approved → ${res.status}`);
  const payload = await res.json();
  return payload.data || [];
}

function needsRender(reel) {
  if (reel.renderJobId) return false;
  if (Array.isArray(reel.variants) && reel.variants.length > 0) return false;
  return true;
}

async function renderOne(reel) {
  inFlight.add(reel.id);
  log(`rendering ${reel.id} (${reel.title || reel.projectSlug})…`);
  const start = Date.now();
  const code = await runRenderPro(reel.id);
  const elapsedMs = Date.now() - start;
  inFlight.delete(reel.id);
  if (code === 0) {
    log(`✓ ${reel.id} rendered in ${(elapsedMs / 1000).toFixed(1)}s`);
  } else {
    log(`× ${reel.id} render-pro exited ${code} after ${(elapsedMs / 1000).toFixed(1)}s`);
  }
}

function runRenderPro(reelId) {
  return new Promise((resolve) => {
    const proc = spawn('node', ['scripts/render-pro.js', reelId], {
      stdio: 'inherit',
      env: { ...process.env, REEL_VARIANT_COUNT: process.env.REEL_VARIANT_COUNT ?? '1' },
    });
    proc.on('exit', (code) => resolve(code ?? 0));
    proc.on('error', () => resolve(1));
  });
}

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
