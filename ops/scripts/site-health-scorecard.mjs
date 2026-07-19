#!/usr/bin/env node
/**
 * site-health combined scorecard.
 *
 * Usage:
 *   node fleet-ops/scripts/site-health-scorecard.mjs --all
 *   node fleet-ops/scripts/site-health-scorecard.mjs --id <product>
 *
 * Live-probes GEO surfaces via agent-index-audit (--json), reads latest
 * geo-observatory trend classes from the ledger, and folds in optional
 * seo/perf artifacts when present (fleet-ops/data/seo-audit/latest.json,
 * fleet-ops/data/psi-swarm/latest.json). Does NOT re-run the heavier
 * seo-audit/psi-swarm passes — use those subskills for fresh data.
 *
 * Output: fleet-ops/docs/site-health-latest.md
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './lib/registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLEET_ROOT = resolve(__dirname, '../..');
const AUDIT = join(FLEET_ROOT, 'fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs');
const LEDGER = join(FLEET_ROOT, 'fleet-ops/data/geo-observatory/ledger.jsonl');
const SEO_ARTIFACT = join(FLEET_ROOT, 'fleet-ops/data/seo-audit/latest.json');
const PERF_ARTIFACT = join(FLEET_ROOT, 'fleet-ops/data/psi-swarm/latest.json');
const OUT = join(FLEET_ROOT, 'fleet-ops/docs/site-health-latest.md');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const onlyId = arg('--id');
const all = process.argv.includes('--all');
if (!all && !onlyId) {
  console.error('Usage: site-health-scorecard.mjs --all | --id <product>');
  process.exit(2);
}

function runGeoAudit() {
  const args = onlyId ? [AUDIT, '--project', onlyId, '--json'] : [AUDIT, '--all', '--json'];
  const r = spawnSync('node', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // audit exits 1 when any host is below S — output is still valid JSON
  try {
    return JSON.parse(r.stdout).results;
  } catch {
    console.error('agent-index-audit did not return JSON:\n', (r.stderr || '').slice(0, 500));
    process.exit(1);
  }
}

function latestTrendClasses() {
  if (!existsSync(LEDGER)) return new Map();
  const entries = readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byProduct = new Map(); // product -> qid -> {date, class}
  for (const e of entries) {
    if (!byProduct.has(e.product)) byProduct.set(e.product, new Map());
    const m = byProduct.get(e.product);
    const prev = m.get(e.qid);
    if (!prev || e.date >= prev.date) m.set(e.qid, { date: e.date, class: e.class });
  }
  const out = new Map();
  for (const [p, m] of byProduct) {
    out.set(p, [...m.entries()].map(([qid, v]) => `${qid.split('-').pop()}:${v.class}`).join(' '));
  }
  return out;
}

function loadArtifact(path) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  } catch {
    return null;
  }
}

function worstProblem(auditResult) {
  if (auditResult.error) return auditResult.error.slice(0, 80);
  const fails = Object.entries(auditResult.checks || {}).filter(([, c]) => c.status === 'fail');
  if (!fails.length) return '';
  // ai_access and sitemap failures are the most damaging; prefer them
  const order = ['ai_access', 'sitemap', 'llms_txt', 'api_ai', 'llms_full', 'robots', 'homepage_md', 'not_spa_fake'];
  fails.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  const [k, c] = fails[0];
  return `${k}: ${c.detail}`.slice(0, 110);
}

function main() {
  const registry = loadRegistry();
  const products = registry.products || [];
  const idsInScope = new Set((onlyId ? products.filter((p) => p.id === onlyId) : products).map((p) => p.id));
  if (onlyId && idsInScope.size === 0) {
    console.error(`Unknown product id: ${onlyId}`);
    process.exit(2);
  }

  process.stderr.write(`Probing GEO surfaces (${idsInScope.size} product(s))…\n`);
  const audit = runGeoAudit();
  const auditByName = new Map(audit.map((r) => [r.name, r]));
  const trend = latestTrendClasses();
  const seo = loadArtifact(SEO_ARTIFACT); // { <productId>: {fail, warn, date} }
  const perf = loadArtifact(PERF_ARTIFACT); // { <productId>: {lcp_p75, cls_p75, inp_p75, date} }

  const rows = [];
  const problems = [];
  for (const p of products) {
    if (!idsInScope.has(p.id)) continue;
    const a = auditByName.get(p.name || p.id) || { tier: '?', score: 0, checks: {} };
    const s = seo?.[p.id];
    const pf = perf?.[p.id];
    const t = trend.get(p.id);
    rows.push(
      `| ${p.id} | ${a.tier} ${a.score ?? 0}% | ` +
        `${s ? `${s.fail}F/${s.warn}W (${s.date})` : '–'} | ` +
        `${pf ? `LCP ${pf.lcp_p75}ms (${pf.date})` : '–'} | ` +
        `${t || '–'} |`
    );
    const w = worstProblem(a);
    if (w) problems.push(`- **${p.id}** — ${w}`);
  }

  const sTier = audit.filter((r) => r.tier === 'S').length;
  const doc = `# Site health — fleet scorecard

Generated ${new Date().toISOString().slice(0, 10)} by \`site-health-scorecard.mjs\`. GEO is live-probed;
seo/perf columns read the latest saved artifacts ("–" = no artifact yet — run
the seo-audit / psi-swarm subskills to populate); trend reads the
geo-observatory ledger. Do not edit by hand.

**GEO: ${sTier}/${audit.length} S-tier.**

| product | GEO | seo | perf p75 | trend |
|---|---|---|---|---|
${rows.join('\n')}

## Problems (worst first per product)

${problems.length ? problems.join('\n') : '_No failing GEO checks._'}
`;
  writeFileSync(OUT, doc, 'utf8');
  console.log(`Scorecard → ${OUT}`);
  if (problems.length) process.exitCode = 1;
}

main();
