#!/usr/bin/env node
/**
 * Launchkit run planner.
 *
 * Reads the launchdesk destination catalog and the per-platform playbooks,
 * then emits a run plan of at most N routes. The plan is deliberately
 * truthful: when fewer than N routes qualify, the target shrinks instead of
 * being padded with unknown or paid routes.
 *
 * Ranking: researched playbooks only; `zeroCostRoute: free` before
 * `conditional`; ties broken by reported DR (desc). Paid and unknown routes
 * are excluded unless --include-paid / --include-unknown is passed.
 *
 * Usage:
 *   node plan-run.mjs [--brief brief.md] [--n 10] [--category Launch,AI]
 *                     [--free-only] [--include-paid] [--include-unknown]
 *                     [--domain a.com,b.com] [--out run-plan.json] [--json]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CATALOG = resolve(REPO_ROOT, 'apps/showcase/src/data/launchdesk.json');
const PLAYBOOKS = resolve(REPO_ROOT, 'apps/showcase/src/data/launchdesk-playbooks');

const args = process.argv.slice(2);
function option(name, fallback = null) {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
}
const has = (flag) => args.includes(flag);

if (has('--help')) {
  console.log(`Usage: plan-run.mjs [--brief brief.md] [--n 10] [--category a,b]
       [--free-only] [--include-paid] [--include-unknown]
       [--domain a.com,b.com] [--out run-plan.json] [--json]`);
  process.exit(0);
}

const N = Number(option('--n', '10')) || 10;
const CATEGORY_FILTER = (option('--category', '') || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const DOMAIN_FILTER = (option('--domain', '') || '')
  .split(',').map((s) => s.trim().toLowerCase().replace(/^www\./, '')).filter(Boolean);
const FREE_ONLY = has('--free-only');
const INCLUDE_PAID = has('--include-paid');
const INCLUDE_UNKNOWN = has('--include-unknown');
const OUT = option('--out');
const AS_JSON = has('--json') || Boolean(OUT);

function briefKeywords(path) {
  if (!path || !existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const line = text.match(/category words[^:\n]*:\s*(.+)/i)?.[1] ?? '';
  return line
    .replace(/<!--.*-->/g, '')
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2);
}
const keywords = briefKeywords(option('--brief'));
const productName = option('--brief')
  ? (readFileSync(option('--brief'), 'utf8').match(/name:\s*(.+)/i)?.[1] ?? '').replace(/<!--.*-->/g, '').trim()
  : '';

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const playbooks = new Map();
for (const file of readdirSync(PLAYBOOKS)) {
  if (!file.endsWith('.json') || file.startsWith('_')) continue;
  const p = JSON.parse(readFileSync(resolve(PLAYBOOKS, file), 'utf8'));
  if (p.domain) playbooks.set(p.domain.toLowerCase(), p);
}

const ROUTE_RANK = { free: 3, conditional: 2, paid: INCLUDE_PAID ? 1 : 0, unknown: INCLUDE_UNKNOWN ? 1 : 0 };

function fitScore(dest) {
  if (!keywords.length) return 0;
  const hay = `${dest.name} ${dest.domain} ${dest.category} ${dest.type ?? ''}`.toLowerCase();
  return keywords.filter((k) => hay.includes(k)).length;
}

const candidates = [];
for (const dest of catalog.destinations) {
  const domain = (dest.domain || '').toLowerCase().replace(/^www\./, '');
  if (dest.quarantined) continue;
  if (DOMAIN_FILTER.length && !DOMAIN_FILTER.includes(domain)) continue;
  if (CATEGORY_FILTER.length && !CATEGORY_FILTER.includes((dest.category || '').toLowerCase())) continue;
  const playbook = playbooks.get(domain);
  if (!playbook) continue;
  const rank = ROUTE_RANK[playbook.zeroCostRoute] ?? 0;
  if (rank === 0) continue;
  if (FREE_ONLY && playbook.zeroCostRoute !== 'free') continue;
  candidates.push({ dest, playbook, rank, fit: fitScore(dest) });
}

candidates.sort((a, b) =>
  b.fit - a.fit || b.rank - a.rank || (b.dest.dr ?? -1) - (a.dest.dr ?? -1)
);

const selected = candidates.slice(0, N);
const plan = {
  $schema: 'fleet.launchkit-run-plan.v1',
  generated: new Date().toISOString().slice(0, 10),
  product: productName || null,
  catalogSnapshot: catalog.snapshot,
  target: selected.length,
  requested: N,
  truthful: selected.length < N
    ? `Only ${selected.length} suitable routes found; target kept smaller rather than padded.`
    : null,
  filters: {
    categories: CATEGORY_FILTER,
    briefKeywords: keywords,
    freeOnly: FREE_ONLY,
    includePaid: INCLUDE_PAID,
    includeUnknown: INCLUDE_UNKNOWN,
  },
  routes: selected.map(({ dest, playbook }, i) => ({
    rank: i + 1,
    domain: dest.domain,
    name: dest.name,
    website: dest.website,
    submissionUrl: dest.submissionUrl,
    category: dest.category,
    reportedDr: dest.dr,
    reportedLink: dest.link,
    zeroCostRoute: playbook.zeroCostRoute,
    conditions: playbook.conditions ?? [],
    playbook: `apps/showcase/src/data/launchdesk-playbooks/${playbook.domain}.json`,
  })),
};

if (AS_JSON) {
  const out = `${JSON.stringify(plan, null, 2)}\n`;
  if (OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(OUT, out);
    console.error(`wrote ${OUT} — ${plan.target} routes`);
  } else {
    process.stdout.write(out);
  }
} else {
  console.log(`Run plan — ${plan.target} of ${N} requested routes (${plan.generated})`);
  if (plan.truthful) console.log(`  note: ${plan.truthful}`);
  for (const r of plan.routes) {
    console.log(`  ${String(r.rank).padStart(2)}. ${r.name.padEnd(28)} ${r.zeroCostRoute.padEnd(11)} dr=${r.reportedDr ?? '—'} ${r.domain}`);
  }
  console.log('Emit JSON with --json or --out run-plan.json');
}
