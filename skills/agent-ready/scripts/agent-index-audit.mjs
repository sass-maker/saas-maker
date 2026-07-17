#!/usr/bin/env node
/**
 * Local fleet agent-index auditor (GEO / LLM indexing).
 *
 * Spec: fleet-ops/docs/agent-indexing-standard.md
 *
 * Usage:
 *   node agent-index-audit.mjs https://rolepatch.com
 *   node agent-index-audit.mjs --all
 *   node agent-index-audit.mjs --all --json
 *   node agent-index-audit.mjs --project rolepatch
 *
 * Targets come from fleet-ops/config/agent-surfaces-registry.json (the
 * canonical product list). Does NOT call isitagentready.com (rate limits).
 * Probes origins directly and detects SPA-fake HTML shells on agent paths.
 *
 * Required checks: llms.txt, /api/ai, homepage markdown, not-SPA-fake,
 * robots (User-agent + Sitemap line), AI-crawler access (GPTBot/ClaudeBot/
 * OAI-SearchBot/PerplexityBot not disallowed), sitemap (real XML, same-host
 * <loc> entries). If /api/ai advertises llmsFull, that URL must resolve.
 * Bonus (reported, not required): /skill.md, IndexNow key file.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts → agent-ready → skills → fleet-ops → fleet root
const FLEET_ROOT = resolve(__dirname, '../../../..');
const REGISTRY_PATH = join(
  FLEET_ROOT,
  'fleet-ops/config/agent-surfaces-registry.json'
);
const INDEXNOW_CONFIG_PATH = join(FLEET_ROOT, 'fleet-ops/config/indexnow.json');

const UA = 'fleet-agent-index-audit/2.0 (+https://sassmaker.com)';
const TIMEOUT_MS = 15_000;

// Answer-engine crawlers that must not be disallowed for GEO to work at all.
const CRITICAL_AI_BOTS = ['GPTBot', 'ClaudeBot', 'OAI-SearchBot', 'PerplexityBot'];
// Reported when blocked, but not required (training-only or low-value bots).
const REPORTED_AI_BOTS = ['Google-Extended', 'CCBot', 'ChatGPT-User', 'Claude-Web'];

const REQUIRED_CHECKS = [
  'llms_txt',
  'api_ai',
  'homepage_md',
  'not_spa_fake',
  'robots',
  'ai_access',
  'sitemap',
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = resolveTargets(args);

  if (targets.length === 0) {
    console.error('No targets. Pass a URL, --project <registry-id>, or --all.');
    process.exit(2);
  }

  const indexNowKey = loadIndexNowKey();

  const results = [];
  for (const t of targets) {
    process.stderr.write(`Auditing ${t.name} (${t.origin})…\n`);
    try {
      results.push(await auditOrigin(t, { indexNowKey }));
    } catch (err) {
      results.push({
        name: t.name,
        origin: t.origin,
        error: String(err?.message || err),
        tier: 'error',
        score: 0,
        checks: {},
      });
    }
  }

  if (args.json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  } else {
    printScoreboard(results);
  }

  const sTier = results.filter((r) => r.tier === 'S').length;
  const failed = results.filter((r) => r.tier !== 'S' && r.tier !== 'error');
  process.stderr.write(
    `\n${sTier}/${results.length} S-tier. ${failed.length} need work.\n`
  );
  process.exit(sTier === results.length ? 0 : 1);
}

function parseArgs(argv) {
  const args = { json: false, all: false, project: null, urls: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--all') args.all = true;
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (a.startsWith('http://') || a.startsWith('https://')) {
      args.urls.push(a);
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  agent-index-audit.mjs <url>
  agent-index-audit.mjs --project <registry-id>
  agent-index-audit.mjs --all [--json]

Targets: fleet-ops/config/agent-surfaces-registry.json
`);
}

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(`Missing agent-surfaces registry at ${REGISTRY_PATH}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
}

function loadIndexNowKey() {
  try {
    if (!existsSync(INDEXNOW_CONFIG_PATH)) return null;
    const cfg = JSON.parse(readFileSync(INDEXNOW_CONFIG_PATH, 'utf8'));
    return typeof cfg.key === 'string' && cfg.key.length >= 16 ? cfg.key : null;
  } catch {
    return null;
  }
}

/** Same origin-preference order as indexnow-submit.mjs — keep in sync. */
function productOrigin(product) {
  const url =
    product.indexNowOrigin ||
    product.marketingOrigin ||
    product.canonicalOrigin ||
    product.url;
  return url ? originOf(String(url)) : null;
}

function resolveTargets(args) {
  if (args.urls.length) {
    return args.urls.map((u) => ({
      name: hostOf(u),
      origin: originOf(u),
    }));
  }

  const registry = loadRegistry();
  const products = registry.products || [];

  if (args.project) {
    const p = products.find((x) => x.id === args.project);
    if (!p) {
      console.error(
        `No product '${args.project}' in registry. Known ids: ${products
          .map((x) => x.id)
          .join(', ')}`
      );
      process.exit(2);
    }
    const origin = productOrigin(p);
    if (!origin) {
      console.error(`Product ${p.id} has no url in the registry`);
      process.exit(2);
    }
    return [{ name: p.name || p.id, origin }];
  }

  if (args.all) {
    return products
      .map((p) => ({ name: p.name || p.id, origin: productOrigin(p), id: p.id }))
      .filter((t) => t.origin);
  }

  return [];
}

/**
 * @param {{ name: string, origin: string }} target
 */
async function auditOrigin(target, { indexNowKey } = {}) {
  const { origin, name } = target;
  const checks = {};

  // --- llms.txt ---
  const llms = await probe(`${origin}/llms.txt`);
  checks.llms_txt = gradeAgentText(llms, { requireHash: true });

  // --- SPA fake on llms ---
  checks.not_spa_fake = {
    status: llms.ok && !llms.isHtml ? 'pass' : 'fail',
    detail: llms.ok
      ? llms.isHtml
        ? 'SPA/HTML shell returned for /llms.txt'
        : 'not an HTML shell'
      : `llms status ${llms.status}`,
  };

  // --- /api/ai ---
  const apiAi = await probe(`${origin}/api/ai`, { accept: 'application/json' });
  checks.api_ai = gradeApiAi(apiAi);

  // --- advertised llms-full must resolve (skip if not advertised) ---
  checks.llms_full = await gradeAdvertisedLlmsFull(apiAi);

  // --- homepage markdown (negotiation or index.md) ---
  const neg = await probe(`${origin}/`, {
    accept: 'text/markdown, text/plain;q=0.9, text/html;q=0.1',
  });
  const indexMd = await probe(`${origin}/index.md`, {
    accept: 'text/markdown, text/plain, */*',
  });
  checks.homepage_md = gradeHomepageMd(neg, indexMd);

  // --- robots + AI-crawler access ---
  const robots = await probe(`${origin}/robots.txt`);
  checks.robots = gradeRobots(robots);
  checks.ai_access = gradeAiAccess(robots);

  // --- sitemap (real XML, same-host locs) ---
  checks.sitemap = await gradeSitemap(origin, robots);

  // Bonus (not required for S but reported)
  const skill = await probe(`${origin}/skill.md`);
  checks.skill_md = {
    status: skill.ok && !skill.isHtml ? 'pass' : 'skip',
    detail: skill.ok && !skill.isHtml ? 'present (S+)' : 'absent (ok for non-agent-native)',
  };

  if (indexNowKey) {
    const keyProbe = await probe(`${origin}/${indexNowKey}.txt`);
    const keyOk = keyProbe.ok && !keyProbe.isHtml && keyProbe.bodyFull?.trim() === indexNowKey;
    checks.indexnow_key = {
      status: keyOk ? 'pass' : 'skip',
      detail: keyOk
        ? 'key file live'
        : `key file not live (${keyProbe.status}${keyProbe.isHtml ? ', HTML shell' : ''}) — IndexNow submits for this host will fail`,
    };
  }

  // llms_full is required only when advertised (skip = not applicable)
  const applicable = [...REQUIRED_CHECKS];
  if (checks.llms_full.status !== 'skip') applicable.push('llms_full');

  const passCount = applicable.filter((k) => checks[k]?.status === 'pass').length;
  const failCount = applicable.filter((k) => checks[k]?.status === 'fail').length;
  const score = Math.round((passCount / applicable.length) * 100);
  const tier =
    failCount === 0 ? 'S' : passCount >= 5 ? 'A' : passCount >= 3 ? 'B' : 'C';

  return {
    name,
    origin,
    tier,
    score,
    pass: passCount,
    fail: failCount,
    checks,
  };
}

function gradeAgentText(probe, { requireHash }) {
  if (!probe.ok) {
    return { status: 'fail', detail: `HTTP ${probe.status || 'err'}` };
  }
  if (probe.isHtml) {
    return { status: 'fail', detail: 'HTML shell (SPA catch-all)' };
  }
  const ct = (probe.contentType || '').toLowerCase();
  if (!ct.includes('text/') && !ct.includes('markdown') && !ct.includes('json')) {
    // some CDNs omit type; allow if body looks like markdown
    if (!probe.bodyPreview?.trimStart().startsWith('#')) {
      return { status: 'fail', detail: `unexpected content-type ${ct || 'empty'}` };
    }
  }
  if (requireHash && !probe.bodyPreview?.trimStart().startsWith('#')) {
    return { status: 'fail', detail: 'body does not start with #' };
  }
  return {
    status: 'pass',
    detail: `${probe.bytes}B ${ct || 'no-ct'}`,
  };
}

function gradeApiAi(probe) {
  if (!probe.ok) {
    return { status: 'fail', detail: `HTTP ${probe.status || 'err'}` };
  }
  if (probe.isHtml) {
    return { status: 'fail', detail: 'HTML shell instead of JSON' };
  }
  try {
    const data = JSON.parse(probe.bodyFull || probe.bodyPreview || '{}');
    const missing = ['name', 'llms', 'surfaces'].filter((k) => data[k] == null);
    if (missing.length) {
      return { status: 'fail', detail: `JSON missing ${missing.join(',')}` };
    }
    if (!Array.isArray(data.surfaces)) {
      return { status: 'fail', detail: 'surfaces is not an array' };
    }
    return {
      status: 'pass',
      detail: `${data.surfaces.length} surfaces, name=${data.name}`,
      data,
    };
  } catch {
    return { status: 'fail', detail: 'body is not JSON' };
  }
}

/** If /api/ai advertises an llmsFull URL, it must actually resolve. */
async function gradeAdvertisedLlmsFull(apiAiProbe) {
  let advertised = null;
  try {
    const data = JSON.parse(apiAiProbe.bodyFull || '{}');
    advertised = typeof data.llmsFull === 'string' ? data.llmsFull : null;
  } catch {
    /* api_ai check reports the JSON problem */
  }
  if (!advertised) {
    return { status: 'skip', detail: 'llmsFull not advertised' };
  }
  const full = await probe(advertised);
  if (!full.ok || full.isHtml) {
    return {
      status: 'fail',
      detail: `api/ai advertises ${advertised} but it returns ${
        full.isHtml ? 'HTML shell' : `HTTP ${full.status || 'err'}`
      }`,
    };
  }
  return { status: 'pass', detail: `advertised llms-full resolves (${full.bytes}B)` };
}

function gradeHomepageMd(neg, indexMd) {
  const negOk =
    neg.ok &&
    !neg.isHtml &&
    (isMarkdownType(neg.contentType) ||
      neg.bodyPreview?.trimStart().startsWith('#'));
  const indexOk =
    indexMd.ok &&
    !indexMd.isHtml &&
    (isMarkdownType(indexMd.contentType) ||
      indexMd.contentType?.includes('text/plain') ||
      indexMd.bodyPreview?.trimStart().startsWith('#'));

  if (negOk) {
    return { status: 'pass', detail: 'Accept: text/markdown negotiation' };
  }
  if (indexOk) {
    return { status: 'pass', detail: '/index.md present' };
  }
  if (neg.ok && neg.isHtml) {
    return { status: 'fail', detail: 'negotiation returned HTML' };
  }
  return {
    status: 'fail',
    detail: `no negotiation (${neg.status}) and no /index.md (${indexMd.status})`,
  };
}

function gradeRobots(probe) {
  if (!probe.ok) return { status: 'fail', detail: `HTTP ${probe.status || 'err'}` };
  if (probe.isHtml) return { status: 'fail', detail: 'HTML instead of robots.txt' };
  const text = probe.bodyFull || probe.bodyPreview || '';
  const hasUa = /user-agent:/i.test(text);
  const hasSitemap = /^\s*sitemap:/im.test(text);
  if (!hasUa) return { status: 'fail', detail: 'no User-agent directive' };
  if (!hasSitemap) return { status: 'fail', detail: 'no Sitemap: line' };
  return { status: 'pass', detail: 'has User-agent + Sitemap' };
}

/**
 * Fail when robots.txt disallows the answer-engine crawlers GEO depends on
 * (e.g. Cloudflare's managed "block AI bots" robots.txt). Serving llms.txt
 * while telling ClaudeBot/GPTBot `Disallow: /` defeats the whole surface.
 */
function gradeAiAccess(probe) {
  if (!probe.ok || probe.isHtml) {
    // No robots.txt (or broken) means nothing is blocked; robots check
    // already reports the problem itself.
    return { status: 'pass', detail: 'no parseable robots.txt — nothing blocked' };
  }
  const groups = parseRobotsGroups(probe.bodyFull || probe.bodyPreview || '');
  const blockedCritical = CRITICAL_AI_BOTS.filter((b) => isBotBlocked(groups, b));
  const blockedReported = REPORTED_AI_BOTS.filter((b) => isBotBlocked(groups, b));
  if (blockedCritical.length) {
    return {
      status: 'fail',
      detail: `robots disallows ${blockedCritical.join(', ')}${
        blockedReported.length ? ` (also: ${blockedReported.join(', ')})` : ''
      } — likely Cloudflare "block AI bots" zone setting`,
    };
  }
  if (blockedReported.length) {
    return {
      status: 'pass',
      detail: `answer-engine bots allowed (training-only blocked: ${blockedReported.join(', ')})`,
    };
  }
  return { status: 'pass', detail: 'AI crawlers allowed' };
}

/** Minimal robots.txt group parser (user-agent groups + allow/disallow). */
function parseRobotsGroups(text) {
  const groups = [];
  let cur = null;
  let lastWasUa = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z][A-Za-z-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!cur || !lastWasUa) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasUa = true;
    } else if (field === 'allow' || field === 'disallow') {
      if (cur) cur.rules.push({ type: field, path: value });
      lastWasUa = false;
    } else {
      lastWasUa = false;
    }
  }
  return groups;
}

function isBotBlocked(groups, bot) {
  const b = bot.toLowerCase();
  let g = groups.find((x) => x.agents.some((a) => a === b));
  if (!g) g = groups.find((x) => x.agents.includes('*'));
  if (!g) return false;
  const disallowRoot = g.rules.some((r) => r.type === 'disallow' && r.path === '/');
  const allowRoot = g.rules.some((r) => r.type === 'allow' && r.path === '/');
  return disallowRoot && !allowRoot;
}

/**
 * A sitemap only passes if it is real XML (urlset/sitemapindex) whose <loc>
 * entries live on the audited host — catches SPA HTML shells served with 200
 * and workers.dev/pages.dev host leaks.
 */
async function gradeSitemap(origin, robotsProbe) {
  const host = hostOf(origin);
  const candidates = [];
  const robotsText = robotsProbe?.bodyFull || '';
  for (const m of robotsText.matchAll(/^\s*sitemap:\s*(\S+)/gim)) {
    candidates.push(m[1]);
  }
  for (const p of ['/sitemap.xml', '/sitemap-index.xml']) {
    const u = `${origin}${p}`;
    if (!candidates.includes(u)) candidates.push(u);
  }

  const failures = [];
  for (const url of candidates) {
    let candidateHost;
    try {
      candidateHost = hostOf(url);
    } catch {
      failures.push(`${url}: unparseable URL`);
      continue;
    }
    if (candidateHost !== host) {
      failures.push(`${url}: advertised sitemap on foreign host ${candidateHost}`);
      continue;
    }
    const s = await probe(url);
    if (!s.ok) {
      failures.push(`${url}: HTTP ${s.status || 'err'}`);
      continue;
    }
    if (s.isHtml) {
      failures.push(`${url}: HTML/SPA shell, not XML`);
      continue;
    }
    const body = s.bodyFull || s.bodyPreview || '';
    const head = body.trimStart().slice(0, 300).toLowerCase();
    const isXml =
      head.startsWith('<?xml') || head.includes('<urlset') || head.includes('<sitemapindex');
    if (!isXml) {
      failures.push(`${url}: not sitemap XML`);
      continue;
    }
    const locs = [...body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((x) => x[1]);
    if (locs.length === 0) {
      failures.push(`${url}: sitemap has zero <loc> entries`);
      continue;
    }
    const foreign = locs.filter((l) => {
      try {
        return hostOf(l) !== host;
      } catch {
        return true;
      }
    });
    if (foreign.length) {
      failures.push(
        `${url}: ${foreign.length}/${locs.length} <loc> on foreign host (e.g. ${foreign[0]})`
      );
      continue;
    }
    return {
      status: 'pass',
      detail: `${new URL(url).pathname} (${s.status}, ${locs.length} locs, ${s.bytes}B)`,
    };
  }
  return {
    status: 'fail',
    detail: failures.length ? failures.join('; ') : 'no sitemap candidates found',
  };
}

function isMarkdownType(ct = '') {
  const c = ct.toLowerCase();
  return c.includes('markdown') || c.includes('text/plain');
}

async function probe(url, { accept } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(accept ? { Accept: accept } : {}),
      },
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    const bytes = buf.byteLength;
    const contentType = res.headers.get('content-type') || '';
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const bodyFull = decoder.decode(buf);
    const bodyPreview = bodyFull.slice(0, 400);
    const isHtml = detectHtml(bodyPreview, contentType);
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      bytes,
      bodyPreview,
      // Keep full body only for small responses (api/ai, robots, llms)
      bodyFull: bytes <= 2_000_000 ? bodyFull : bodyPreview,
      isHtml,
      finalUrl: res.url,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      contentType: '',
      bytes: 0,
      bodyPreview: '',
      bodyFull: '',
      isHtml: false,
      error: String(err?.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function detectHtml(preview, contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) return true;
  const head = (preview || '').slice(0, 200).toLowerCase();
  return (
    head.includes('<!doctype') ||
    head.includes('<html') ||
    head.includes('<div id="root"') ||
    head.includes('<div id="app"')
  );
}

function printScoreboard(results) {
  const sorted = [...results].sort((a, b) => {
    const order = { S: 0, A: 1, B: 2, C: 3, error: 4 };
    return (order[a.tier] ?? 9) - (order[b.tier] ?? 9) || b.score - a.score;
  });

  console.log('\n=== FLEET AGENT-INDEX SCOREBOARD (GEO) ===\n');
  console.log(
    pad('Tier', 4) +
      pad('Score', 6) +
      pad('Project', 28) +
      pad('llms', 6) +
      pad('api/ai', 7) +
      pad('home.md', 8) +
      pad('robots', 7) +
      pad('ai-ok', 6) +
      'sitemap'
  );
  console.log('-'.repeat(96));

  for (const r of sorted) {
    if (r.error) {
      console.log(`err  ${pad('0%', 6)}${pad(r.name, 28)}${r.error}`);
      continue;
    }
    const mark = (k) => (r.checks[k]?.status === 'pass' ? '✓' : '✗');
    console.log(
      pad(r.tier, 4) +
        pad(`${r.score}%`, 6) +
        pad(r.name, 28) +
        pad(mark('llms_txt'), 6) +
        pad(mark('api_ai'), 7) +
        pad(mark('homepage_md'), 8) +
        pad(mark('robots'), 7) +
        pad(mark('ai_access'), 6) +
        mark('sitemap')
    );
  }

  console.log('\n--- Failures (detail) ---\n');
  for (const r of sorted) {
    if (r.error || r.tier === 'S') continue;
    const fails = Object.entries(r.checks)
      .filter(([, c]) => c.status === 'fail')
      .map(([k, c]) => `    ${k}: ${c.detail}`);
    if (fails.length) {
      console.log(`${r.name} (${r.origin}) — ${r.tier}`);
      console.log(fails.join('\n'));
      console.log();
    }
  }
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function originOf(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

function hostOf(url) {
  return new URL(url).host;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
