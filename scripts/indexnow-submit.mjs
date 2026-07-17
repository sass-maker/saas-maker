#!/usr/bin/env node
/**
 * Fleet IndexNow submitter — notify Bing/Yandex/Naver/Seznam/Yep of URLs.
 *
 * Google is NOT covered (use Search Console). See fleet-ops/docs/indexnow.md.
 *
 * Usage:
 *   node fleet-ops/scripts/indexnow-submit.mjs --init-key
 *   node fleet-ops/scripts/indexnow-submit.mjs --apply-keys
 *   node fleet-ops/scripts/indexnow-submit.mjs --dry-run
 *   node fleet-ops/scripts/indexnow-submit.mjs
 *   node fleet-ops/scripts/indexnow-submit.mjs --id rolepatch
 *   node fleet-ops/scripts/indexnow-submit.mjs --url https://rolepatch.com/
 *   node fleet-ops/scripts/indexnow-submit.mjs --host rolepatch.com --max 50
 *   node fleet-ops/scripts/indexnow-submit.mjs --check-keys
 */

import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLEET_ROOT = resolve(__dirname, '../..');
const CONFIG_PATH = join(FLEET_ROOT, 'fleet-ops/config/indexnow.json');
const REGISTRY_PATH = join(
  FLEET_ROOT,
  'fleet-ops/config/agent-surfaces-registry.json'
);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const dryRun = flag('--dry-run');
const onlyId = opt('--id');
const onlyHost = opt('--host');
const singleUrl = opt('--url');
const maxUrls = opt('--max') ? Number(opt('--max')) : Infinity;
const initKey = flag('--init-key');
const applyKeys = flag('--apply-keys');
const checkKeys = flag('--check-keys');
const verbose = flag('--verbose') || flag('-v');

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Missing ${CONFIG_PATH}`);
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

function loadRegistry() {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
}

function productOrigin(product) {
  let url = product.url;
  // Prefer primary marketing host for Pace
  if (product.id === 'pace') url = 'https://heypace.app';
  return url.replace(/\/$/, '');
}

function hostOf(origin) {
  return new URL(origin).host;
}

function keyLocation(origin, key) {
  return `${origin.replace(/\/$/, '')}/${key}.txt`;
}

/** Generate key if empty. */
function ensureKey(cfg) {
  if (cfg.key && String(cfg.key).trim()) return cfg;
  cfg.key = randomBytes(16).toString('hex');
  saveConfig(cfg);
  console.log(`Generated IndexNow key → ${CONFIG_PATH}`);
  console.log(`  key=${cfg.key}`);
  console.log(`  Host as /${cfg.key}.txt on each origin (use --apply-keys).`);
  return cfg;
}

/** Write {key}.txt into each product publicDir. */
function applyKeyFiles(cfg, products) {
  if (!cfg.key) throw new Error('No key — run --init-key first');
  let n = 0;
  for (const p of products) {
    if (!p.publicDir) {
      console.log(`· ${p.id}: no publicDir (skip key file)`);
      continue;
    }
    const dir = join(FLEET_ROOT, p.publicDir);
    if (!existsSync(dir)) {
      console.log(`· ${p.id}: publicDir missing ${p.publicDir}`);
      continue;
    }
    const path = join(dir, `${cfg.key}.txt`);
    if (!dryRun) writeFileSync(path, `${cfg.key}\n`, 'utf8');
    n++;
    console.log(`✓ ${p.id}: ${path}${dryRun ? ' (dry-run)' : ''}`);
  }
  console.log(
    `\nWrote key file for ${n} products. Deploy so https://{host}/${cfg.key}.txt is live, then submit.`
  );
}

async function fetchText(url, userAgent) {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent, Accept: '*/*' },
    redirect: 'follow',
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, finalUrl: res.url };
}

function looksLikeHtml(text) {
  const head = text.slice(0, 200).toLowerCase();
  return (
    head.includes('<!doctype') ||
    head.includes('<html') ||
    head.includes('<head')
  );
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) {
    locs.push(m[1].trim());
  }
  return locs;
}

async function collectSitemapUrls(origin, userAgent, max) {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap-index.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  // robots Sitemap:
  try {
    const rob = await fetchText(`${origin}/robots.txt`, userAgent);
    if (rob.ok && !looksLikeHtml(rob.text)) {
      for (const line of rob.text.split(/\r?\n/)) {
        const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
        if (m) candidates.unshift(m[1].replace(/\/$/, ''));
      }
    }
  } catch {
    /* ignore */
  }

  const seen = new Set();
  const urls = [];
  const queue = [];

  for (const c of candidates) {
    if (!seen.has(c)) {
      seen.add(c);
      queue.push(c);
    }
  }

  while (queue.length && urls.length < max) {
    const smUrl = queue.shift();
    let res;
    try {
      res = await fetchText(smUrl, userAgent);
    } catch (e) {
      if (verbose) console.warn(`  sitemap fail ${smUrl}: ${e.message}`);
      continue;
    }
    if (!res.ok || looksLikeHtml(res.text)) {
      if (verbose)
        console.warn(
          `  skip sitemap ${smUrl} status=${res.status} html=${looksLikeHtml(res.text)}`
        );
      continue;
    }
    const locs = extractLocs(res.text);
    const isIndex =
      /<sitemapindex/i.test(res.text) || smUrl.includes('sitemap-index');
    for (const loc of locs) {
      if (isIndex && /sitemap/i.test(loc)) {
        if (!seen.has(loc)) {
          seen.add(loc);
          queue.push(loc);
        }
        continue;
      }
      // only same host
      try {
        if (new URL(loc).host !== new URL(origin).host) continue;
      } catch {
        continue;
      }
      if (!urls.includes(loc)) urls.push(loc);
      if (urls.length >= max) break;
    }
  }

  // Always include homepage + agent surfaces
  const always = [
    `${origin}/`,
    `${origin}/llms.txt`,
    `${origin}/llms-full.txt`,
    `${origin}/index.md`,
    `${origin}/api/ai`,
  ];
  for (const u of always) {
    if (!urls.includes(u)) urls.unshift(u);
  }
  return urls.slice(0, max === Infinity ? undefined : max);
}

async function checkKeyLive(origin, key, userAgent) {
  const loc = keyLocation(origin, key);
  try {
    const res = await fetchText(loc, userAgent);
    const body = res.text.trim();
    const ok = res.ok && body === key;
    return { loc, ok, status: res.status, body: body.slice(0, 40) };
  } catch (e) {
    return { loc, ok: false, status: 'ERR', body: e.message };
  }
}

async function submitBatch(cfg, host, urlList) {
  const key = cfg.key;
  const keyLocationUrl = `https://${host}/${key}.txt`;
  const payload = {
    host,
    key,
    keyLocation: keyLocationUrl,
    urlList,
  };

  if (dryRun) {
    console.log(
      `  [dry-run] POST ${cfg.endpoint} host=${host} urls=${urlList.length}`
    );
    if (verbose) console.log(JSON.stringify(payload, null, 2));
    return { ok: true, status: 0, dryRun: true };
  }

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': cfg.userAgent || 'fleet-indexnow/1.0',
    },
    body: JSON.stringify(payload),
  });
  // IndexNow: 200/202 success; 4xx failure
  const text = await res.text().catch(() => '');
  return {
    ok: res.status === 200 || res.status === 202,
    status: res.status,
    body: text.slice(0, 200),
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  let cfg = loadConfig();
  const registry = loadRegistry();
  let products = registry.products || [];

  if (initKey) {
    cfg = ensureKey(cfg);
    return;
  }

  cfg = ensureKey(cfg);
  if (!cfg.key) throw new Error('No IndexNow key configured');

  if (onlyId) products = products.filter((p) => p.id === onlyId);

  if (applyKeys) {
    applyKeyFiles(cfg, products);
    return;
  }

  if (checkKeys) {
    console.log(`Checking live key files for key=${cfg.key.slice(0, 8)}…\n`);
    let okN = 0;
    for (const p of products) {
      const origin = productOrigin(p);
      if (onlyHost && hostOf(origin) !== onlyHost) continue;
      const r = await checkKeyLive(origin, cfg.key, cfg.userAgent);
      const mark = r.ok ? '✓' : '✗';
      if (r.ok) okN++;
      console.log(`${mark} ${p.id}: ${r.loc} → ${r.status}${r.ok ? '' : ` body=${r.body}`}`);
    }
    console.log(`\n${okN} live key(s). Deploy --apply-keys output before submit if any ✗.`);
    return;
  }

  // Collect work: host → urls
  /** @type {Map<string, { origin: string, id: string, urls: string[] }>} */
  const byHost = new Map();

  if (singleUrl) {
    const u = new URL(singleUrl);
    const host = u.host;
    byHost.set(host, {
      origin: `${u.protocol}//${u.host}`,
      id: onlyId || host,
      urls: [singleUrl],
    });
  } else {
    for (const p of products) {
      const origin = productOrigin(p);
      const host = hostOf(origin);
      if (onlyHost && host !== onlyHost) continue;
      process.stdout.write(`Collect ${p.id} (${origin})… `);
      const urls = await collectSitemapUrls(
        origin,
        cfg.userAgent || 'fleet-indexnow/1.0',
        maxUrls
      );
      console.log(`${urls.length} urls`);
      const prev = byHost.get(host);
      if (prev) {
        const set = new Set([...prev.urls, ...urls]);
        prev.urls = [...set];
      } else {
        byHost.set(host, { origin, id: p.id, urls });
      }
    }
  }

  if (byHost.size === 0) {
    console.log('Nothing to submit.');
    return;
  }

  const batchSize = Number(cfg.batchSize) || 100;
  let submitted = 0;
  let batchesOk = 0;
  let batchesFail = 0;

  for (const [host, work] of byHost) {
    console.log(`\n▸ ${host} (${work.id}) — ${work.urls.length} URLs`);
    if (!dryRun) {
      const keyCheck = await checkKeyLive(
        work.origin,
        cfg.key,
        cfg.userAgent
      );
      if (!keyCheck.ok) {
        console.warn(
          `  ⚠ key not live at ${keyCheck.loc} (${keyCheck.status}). IndexNow may reject. Run --apply-keys + deploy, or --check-keys.`
        );
      }
    }
    const batches = chunk(work.urls, batchSize);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const result = await submitBatch(cfg, host, batch);
      if (result.ok) {
        batchesOk++;
        submitted += batch.length;
        console.log(
          `  batch ${i + 1}/${batches.length}: OK status=${result.status} n=${batch.length}`
        );
      } else {
        batchesFail++;
        console.error(
          `  batch ${i + 1}/${batches.length}: FAIL status=${result.status} ${result.body || ''}`
        );
      }
      // be polite
      if (!dryRun) await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(
    `\nDone. urls=${submitted} batches_ok=${batchesOk} batches_fail=${batchesFail}${dryRun ? ' (dry-run)' : ''}`
  );
  console.log(
    'Note: IndexNow ≠ Google. Submit sitemaps in Google Search Console separately.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
