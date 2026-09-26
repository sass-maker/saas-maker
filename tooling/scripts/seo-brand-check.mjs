#!/usr/bin/env node
/**
 * Brand-coverage gate: for every Search Console property, fetch the homepage
 * and verify the signals that let Google bind the brand name to the domain.
 * Owning your own name is the floor — split-word and category queries only
 * convert after the brand query is won.
 *
 * Usage:
 *   node scripts/seo-brand-check.mjs [--project <id>] [--format markdown|json]
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUTCOMES_PATH = join(homedir(), '.fleet', 'visibility-outcomes', 'ledger.jsonl');

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  const v = args[i + 1];
  return i >= 0 && v && !v.startsWith('--') ? v : null;
};
const projectFilter = opt('--project');
const format = opt('--format') ?? 'markdown';

/** Latest search record per project → homepage URL (from the scope's page filter). */
function homepages() {
  if (!existsSync(OUTCOMES_PATH)) return new Map();
  const latest = new Map();
  for (const line of readFileSync(OUTCOMES_PATH, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.family !== 'search') continue;
    const page = row.scope?.match(/page:(\S+)/)?.[1];
    if (!page) continue;
    const prev = latest.get(row.projectId);
    if (!prev || row.observedAt > prev.observedAt) latest.set(row.projectId, { ...row, page });
  }
  return latest;
}

/** Brand display name: prefer the <title> prefix before " — ", else project id. */
function brandName(title, projectId, host) {
  const m = title?.match(/^([^—·|–]{2,40}?)\s*[—·|–-]\s/);
  if (m) return m[1].trim();
  return projectId.replace(/-/g, ' ');
}

async function audit(projectId, url) {
  let html = '';
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { 'user-agent': 'fleet-seo-brand/1.0 (+site-health)', accept: 'text/html' },
    });
    html = res.ok ? await res.text() : '';
  } catch { /* fall through to error row */ }
  if (!html) return { projectId, url, error: 'unreachable' };

  const pick = (re) => {
    const m = html.match(re);
    return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null;
  };
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i))?.[1] ?? null;

  const brand = brandName(title, projectId, new URL(url).host);
  const brandTokens = brand.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const contains = (s) => s && brandTokens.every((t) => s.toLowerCase().includes(t));

  const ldNodes = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1]);
      const nodes = Array.isArray(d) ? d : (d['@graph'] ?? [d]);
      ldNodes.push(...nodes.filter((n) => n && typeof n === 'object'));
    } catch { /* ignore */ }
  }
  const hasWebSite = ldNodes.some((n) => n['@type'] === 'WebSite' && contains(String(n.name ?? '')));
  const hasEntity = ldNodes.some((n) =>
    ['Organization', 'Person', 'SoftwareApplication', 'WebApplication', 'MobileApplication', 'Product', 'VideoGame'].includes(n['@type'])
    && contains(String(n.name ?? '')));
  const alternates = [...new Set(ldNodes.flatMap((n) => [n.alternateName].flat().filter(Boolean)))];

  const checks = {
    'title brand-first': contains(title?.split(/[—·|–]/)[0] ?? title),
    'h1 or hero has brand': contains(h1) || contains(desc) || html.toLowerCase().includes(brand.toLowerCase()),
    'meta description': desc != null && desc.length > 30,
    'WebSite schema w/ brand': hasWebSite,
    'entity schema (Org/Person/App)': hasEntity,
    'canonical': /<link[^>]+rel=["']canonical["']/.test(html),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { projectId, url, brand, title, h1, checks, alternates, score, total: Object.keys(checks).length };
}

const homes = homepages();
const targets = [...homes.entries()].filter(([id]) => !projectFilter || id === projectFilter);
const results = [];
for (const [id, row] of targets) results.push(await audit(id, row.page));
results.sort((a, b) => (a.score ?? 9) - (b.score ?? 9));

if (format === 'json') {
  console.log(JSON.stringify({ schema: 'fleet.seo-brand-check.v1', results }, null, 2));
  process.exit(0);
}

for (const r of results) {
  if (r.error) { console.log(`- **${r.projectId}** — ${r.error} (${r.url})`); continue; }
  const fails = Object.entries(r.checks).filter(([, ok]) => !ok).map(([k]) => k);
  console.log(`- **${r.projectId}** ${r.score}/${r.total} — "${r.brand}" @ ${r.url}${fails.length ? ` — MISSING: ${fails.join(', ')}` : ' — clean'}`);
}
