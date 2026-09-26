#!/usr/bin/env node
/**
 * Query→page alignment report. Reads the latest Search Console observation per
 * project (query + landingPage pairs from ~/.fleet/visibility-outcomes), fetches
 * each surfaced page, extracts <title> and <h1>, and flags where the page's
 * own headings don't contain the words Google is already ranking it for.
 *
 * Usage:
 *   node scripts/seo-query-align.mjs [--project <id>] [--min-impressions 2]
 *     [--max-pages 20] [--format markdown|json]
 *
 * Credential-free for measurement (local ledger); fetches only public pages.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUTCOMES_PATH = join(homedir(), '.fleet', 'visibility-outcomes', 'ledger.jsonl');
const STOPWORDS = new Set(('a an the and or of to in for on at is are was were be been it its ' +
  'that this with as by from what how why which who when where can you your i my we our do does did ' +
  'vs not no yes s t re m d ll ve'.split(' ')));

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  const v = args[i + 1];
  return i >= 0 && v && !v.startsWith('--') ? v : fallback;
};
const projectFilter = opt('--project', null);
const minImpressions = Number(opt('--min-impressions', 2));
const maxPages = Number(opt('--max-pages', 20));
const format = opt('--format', 'markdown');

function latestSearchTerms() {
  if (!existsSync(OUTCOMES_PATH)) return new Map();
  const latest = new Map();
  for (const line of readFileSync(OUTCOMES_PATH, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.family !== 'search' || !Array.isArray(row.searchTerms) || !row.searchTerms.length) continue;
    const prev = latest.get(row.projectId);
    if (!prev || row.observedAt > prev.observedAt) latest.set(row.projectId, row);
  }
  return latest;
}

/** Group terms by landing page; per page keep the highest-impression query. */
function pagesFor(row) {
  const byPage = new Map();
  for (const t of row.searchTerms ?? []) {
    if (!t.landingPage || !t.query || t.impressions < minImpressions) continue;
    const cur = byPage.get(t.landingPage);
    if (!cur || t.impressions > cur.impressions) byPage.set(t.landingPage, t);
  }
  return [...byPage.entries()]
    .map(([url, t]) => ({ url, ...t }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, maxPages);
}

function tokens(text) {
  return text.toLowerCase().replace(/["'']/g, ' ').split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function extract(html) {
  const pick = (re) => {
    const m = html.match(re);
    return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : null;
  };
  return {
    title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i),
    h1: pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i),
    description: (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i))?.[1] ?? null,
  };
}

async function fetchHead(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { 'user-agent': 'fleet-seo-align/1.0 (+site-health)', accept: 'text/html' },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const html = await res.text();
    return { status: res.status, finalUrl: res.url, ...extract(html) };
  } catch (err) {
    return { error: err.cause?.code ?? err.message };
  }
}

/** Fraction of the query's significant tokens present in a heading string. */
function coverage(queryTokens, heading) {
  if (!heading || !queryTokens.length) return 0;
  const hay = new Set(tokens(heading));
  return queryTokens.filter((t) => hay.has(t)).length / queryTokens.length;
}

const terms = latestSearchTerms();
const projects = [...terms.entries()].filter(([id]) => !projectFilter || id === projectFilter);
if (!projects.length) {
  console.error(projectFilter ? `No search-term data for ${projectFilter}` : 'No search-term data');
  process.exit(1);
}

const reports = [];
for (const [projectId, row] of projects) {
  const pages = pagesFor(row);
  const findings = [];
  for (const p of pages) {
    const head = await fetchHead(p.url);
    if (head.error) {
      findings.push({ ...p, error: head.error });
      continue;
    }
    const qt = tokens(p.query);
    const titleCov = coverage(qt, head.title);
    const h1Cov = coverage(qt, head.h1);
    const aligned = titleCov >= 0.6 && (head.h1 == null || h1Cov >= 0.5);
    findings.push({
      ...p, title: head.title, h1: head.h1, description: head.description,
      titleCoverage: titleCov, h1Coverage: head.h1 == null ? null : h1Cov,
      missingTokens: qt.filter((t) => !(head.title ?? '').toLowerCase().includes(t)),
      aligned,
      clientRendered: head.h1 == null && head.title != null,
    });
  }
  findings.sort((a, b) => b.impressions - a.impressions);
  reports.push({ projectId, observedAt: row.observedAt, findings });
}

if (format === 'json') {
  console.log(JSON.stringify({ schema: 'fleet.seo-query-align.v1', reports }, null, 2));
  process.exit(0);
}

for (const r of reports) {
  console.log(`\n## ${r.projectId} (observed ${r.observedAt.slice(0, 10)})`);
  const mis = r.findings.filter((f) => !f.error && !f.aligned);
  const ok = r.findings.filter((f) => !f.error && f.aligned);
  const err = r.findings.filter((f) => f.error);
  console.log(`${mis.length} misaligned · ${ok.length} aligned · ${err.length} unreachable\n`);
  for (const f of mis) {
    console.log(`- **${f.impressions} imp · pos ${f.position.toFixed(0)}** — ${f.url}`);
    console.log(`  query: "${f.query}"`);
    console.log(`  title: ${f.title ?? '(none)'}${f.h1 == null ? '  ⚠ no <h1> in served HTML' : ''}`);
    if (f.h1) console.log(`  h1:    ${f.h1}`);
    if (f.missingTokens.length) console.log(`  missing words: ${f.missingTokens.join(', ')}`);
  }
}
