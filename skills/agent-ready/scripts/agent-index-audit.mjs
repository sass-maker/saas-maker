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
 * Does NOT call isitagentready.com (rate limits). Probes origins directly
 * and detects SPA-fake HTML shells on agent paths.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts → agent-ready → skills → fleet-ops → fleet root
const FLEET_ROOT = resolve(__dirname, '../../../..');
const CONTRACTS_PATH = join(
  FLEET_ROOT,
  'saas-maker/scripts/lib/fleet-health-contracts.mjs'
);

const UA = 'fleet-agent-index-audit/1.0 (+https://sassmaker.com)';
const TIMEOUT_MS = 15_000;

const REQUIRED_CHECKS = [
  'llms_txt',
  'api_ai',
  'homepage_md',
  'not_spa_fake',
  'robots',
  'sitemap',
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = await resolveTargets(args);

  if (targets.length === 0) {
    console.error('No targets. Pass a URL, --project <name>, or --all.');
    process.exit(2);
  }

  const results = [];
  for (const t of targets) {
    process.stderr.write(`Auditing ${t.name} (${t.origin})…\n`);
    try {
      results.push(await auditOrigin(t));
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
  agent-index-audit.mjs --project <health-contract-key>
  agent-index-audit.mjs --all [--json]
`);
}

async function resolveTargets(args) {
  if (args.urls.length) {
    return args.urls.map((u) => ({
      name: hostOf(u),
      origin: originOf(u),
    }));
  }

  const contracts = await loadContracts();
  if (args.project) {
    const c = contracts[args.project];
    if (!c?.prodUrl) {
      console.error(`No prodUrl for project ${args.project}`);
      process.exit(2);
    }
    return [{ name: c.displayName || args.project, origin: originOf(c.prodUrl) }];
  }

  if (args.all) {
    return Object.entries(contracts)
      .filter(([, c]) => c.prodUrl)
      .map(([key, c]) => ({
        name: c.displayName || key,
        origin: originOf(c.prodUrl),
        key,
      }))
      // Prefer marketing apex when saas-maker points at app login
      .map((t) => {
        if (t.key === 'saas-maker') {
          return { ...t, origin: 'https://sassmaker.com', name: 'SaaS Maker (marketing)' };
        }
        return t;
      });
  }

  return [];
}

async function loadContracts() {
  if (!existsSync(CONTRACTS_PATH)) {
    console.error(`Missing fleet health contracts at ${CONTRACTS_PATH}`);
    process.exit(2);
  }
  const mod = await import(pathToFileURL(CONTRACTS_PATH).href);
  return mod.FLEET_HEALTH_CONTRACTS;
}

/**
 * @param {{ name: string, origin: string }} target
 */
async function auditOrigin(target) {
  const { origin, name } = target;
  const checks = {};

  // --- llms.txt ---
  const llms = await probe(`${origin}/llms.txt`);
  checks.llms_txt = gradeAgentText(llms, { requireHash: true });

  // --- SPA fake on llms ---
  checks.not_spa_fake = {
    status: llms.ok && !llms.isHtml ? 'pass' : llms.ok && llms.isHtml ? 'fail' : 'fail',
    detail: llms.ok
      ? llms.isHtml
        ? 'SPA/HTML shell returned for /llms.txt'
        : 'not an HTML shell'
      : `llms status ${llms.status}`,
  };

  // --- /api/ai ---
  const apiAi = await probe(`${origin}/api/ai`, { accept: 'application/json' });
  checks.api_ai = gradeApiAi(apiAi);

  // --- homepage markdown (negotiation or index.md) ---
  const neg = await probe(`${origin}/`, {
    accept: 'text/markdown, text/plain;q=0.9, text/html;q=0.1',
  });
  const indexMd = await probe(`${origin}/index.md`, {
    accept: 'text/markdown, text/plain, */*',
  });
  checks.homepage_md = gradeHomepageMd(neg, indexMd);

  // --- robots ---
  const robots = await probe(`${origin}/robots.txt`);
  checks.robots = gradeRobots(robots);

  // --- sitemap ---
  const smPaths = ['/sitemap.xml', '/sitemap-index.xml'];
  let sitemap = null;
  for (const p of smPaths) {
    const s = await probe(`${origin}${p}`);
    if (s.ok && !s.isHtml) {
      sitemap = s;
      sitemap.path = p;
      break;
    }
  }
  checks.sitemap = {
    status: sitemap ? 'pass' : 'fail',
    detail: sitemap
      ? `${sitemap.path} (${sitemap.status}, ${sitemap.bytes}B)`
      : 'no sitemap.xml / sitemap-index.xml',
  };

  // Bonus (not required for S but reported)
  const skill = await probe(`${origin}/skill.md`);
  checks.skill_md = {
    status: skill.ok && !skill.isHtml ? 'pass' : 'skip',
    detail: skill.ok && !skill.isHtml ? 'present (S+)' : 'absent (ok for non-agent-native)',
  };

  const passCount = REQUIRED_CHECKS.filter((k) => checks[k]?.status === 'pass').length;
  const failCount = REQUIRED_CHECKS.filter((k) => checks[k]?.status === 'fail').length;
  const score = Math.round((passCount / REQUIRED_CHECKS.length) * 100);
  const tier =
    failCount === 0 ? 'S' : passCount >= 4 ? 'A' : passCount >= 2 ? 'B' : 'C';

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
    };
  } catch {
    return { status: 'fail', detail: 'body is not JSON' };
  }
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
  const hasSitemap = /sitemap:/i.test(text);
  if (!hasUa) return { status: 'fail', detail: 'no User-agent directive' };
  return {
    status: 'pass',
    detail: hasSitemap ? 'has User-agent + Sitemap' : 'has User-agent (no Sitemap line)',
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
      bodyFull: bytes <= 512_000 ? bodyFull : bodyPreview,
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
      'sitemap'
  );
  console.log('-'.repeat(90));

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

// silence unused import if tree-shaken
void readFileSync;

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
