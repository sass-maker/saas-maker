#!/usr/bin/env node
/**
 * Live verification sweep for the launchdesk destination catalog.
 *
 * For every active destination, fetches the website and the submissionUrl
 * (when present) and records what the network actually says: dead domains,
 * parked/for-sale pages, redirect-aways, broken submission routes, and —
 * for the few rows that carry exampleUrl — whether the example listing's
 * outbound links are follow or nofollow.
 *
 * Results land in two places:
 *   - a status report JSON (default stdout summary, --out for full rows)
 *   - the dataset itself, when --write is passed: `measured` is stamped and
 *     measured flags are added/removed so the catalog reflects what was
 *     observed today rather than what sources once claimed.
 *
 * Measured flags added/removed by this script:
 *   Domain unreachable          — website fetch failed outright
 *   Domain redirects elsewhere  — website resolves to a different registrable host
 *   Site appears parked         — parked/for-sale markers in the HTML
 *   Submission route broken     — submissionUrl returned 4xx/5xx
 *   Example link verified follow    — exampleUrl listing links out with follow
 *   Example link observed nofollow  — exampleUrl listing links out with nofollow
 *
 * No response bodies are persisted — only statuses and extracted booleans.
 *
 * Run:
 *   node scripts/verify-launchdesk.mjs --limit 30        # pilot
 *   node scripts/verify-launchdesk.mjs --write           # full sweep + apply
 *   node scripts/verify-launchdesk.mjs --domain saashub.com,uneed.best
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const DATASET = resolve(root, 'apps/showcase/src/data/launchdesk.json');

const USAGE = `Usage: verify-launchdesk.mjs [--limit N] [--domain a,b,c]
       [--concurrency N] [--timeout MS] [--out <path>] [--write]`;

const args = process.argv.slice(2);
function option(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

if (args.includes('--help')) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const LIMIT = Number(option('--limit', '0')) || 0;
const DOMAINS = (option('--domain', '') || '').split(',').filter(Boolean);
const CONCURRENCY = Number(option('--concurrency', '16'));
const TIMEOUT_MS = Number(option('--timeout', '12000'));
const OUT = option('--out');
const WRITE = args.includes('--write');
const TODAY = new Date().toISOString().slice(0, 10);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

const PARKED_MARKERS = [
  'domain is for sale',
  'buy this domain',
  'this domain may be for sale',
  'domain parking',
  'sedoparking',
  'afternic',
  'hugedomains',
  'dan.com',
  'parkingcrew',
  'domainmarket.com',
  'namecheap.com/domains/registration/results',
];

const MEASURED_FLAGS = [
  'Domain unreachable',
  'Domain redirects elsewhere',
  'Site appears parked',
  'Submission route broken',
  'Example link verified follow',
  'Example link observed nofollow',
];

function registrable(host) {
  const parts = host.toLowerCase().split('.');
  return parts.length <= 2 ? host.toLowerCase() : parts.slice(-2).join('.');
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    });
    const html = res.status < 500 ? await res.text() : '';
    return { ok: true, status: res.status, finalUrl: res.url, html };
  } catch (error) {
    return { ok: false, status: null, finalUrl: null, error: String(error?.name ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

function isParked(html) {
  const haystack = html.toLowerCase().slice(0, 200_000);
  return PARKED_MARKERS.some((marker) => haystack.includes(marker));
}

function outboundLinkRel(html, siteHost) {
  // Inspect external <a> tags on an example listing page and report the
  // dominant rel posture toward listed products.
  const anchors = html.match(/<a\s[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi) ?? [];
  const siteReg = registrable(siteHost);
  let follow = 0;
  let nofollow = 0;
  for (const tag of anchors) {
    const href = /href=["'](https?:\/\/[^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    try {
      if (registrable(new URL(href).hostname) === siteReg) continue;
    } catch {
      continue;
    }
    const rel = /rel=["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    if (/\b(nofollow|sponsored|ugc)\b/i.test(rel)) nofollow += 1;
    else follow += 1;
  }
  if (follow === 0 && nofollow === 0) return 'unobserved';
  return nofollow > follow ? 'nofollow' : 'follow';
}

async function verify(row) {
  const result = { domain: row.domain, flags: [], statuses: {} };

  const site = await probe(row.website);
  result.statuses.website = site.status ?? 'error';
  if (!site.ok) {
    result.flags.push('Domain unreachable');
    return result; // dead domain — skip deeper probes
  }
  const finalHost = new URL(site.finalUrl).hostname;
  if (registrable(finalHost) !== registrable(row.domain)) {
    result.flags.push('Domain redirects elsewhere');
  }
  if (isParked(site.html)) {
    result.flags.push('Site appears parked');
  }
  if (new URL(site.finalUrl).protocol === 'http:') {
    result.flags.push('Source uses HTTP');
  }

  if (row.submissionUrl) {
    const sub = await probe(row.submissionUrl);
    result.statuses.submissionUrl = sub.status ?? 'error';
    // 403/429 are typically bot walls, not broken routes — only flag
    // definitive failures.
    if (!sub.ok || sub.status === 404 || sub.status === 410 || sub.status >= 500) {
      result.flags.push('Submission route broken');
    }
  }

  if (row.exampleUrl) {
    const ex = await probe(row.exampleUrl);
    result.statuses.exampleUrl = ex.status ?? 'error';
    if (ex.ok && ex.status < 400) {
      const rel = outboundLinkRel(ex.html, row.domain);
      result.statuses.exampleLinkRel = rel;
      if (rel === 'follow') result.flags.push('Example link verified follow');
      if (rel === 'nofollow') result.flags.push('Example link observed nofollow');
    }
  }

  return result;
}

async function main() {
  const data = JSON.parse(readFileSync(DATASET, 'utf8'));
  let targets = data.destinations.filter((row) => !row.quarantined);
  if (DOMAINS.length) targets = targets.filter((row) => DOMAINS.includes(row.domain));
  if (LIMIT) targets = targets.slice(0, LIMIT);

  process.stderr.write(`verifying ${targets.length} destinations (concurrency ${CONCURRENCY})\n`);

  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const row = targets[cursor++];
      results.push(await verify(row));
      if (results.length % 100 === 0) {
        process.stderr.write(`  ${results.length}/${targets.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const summary = {};
  for (const r of results) {
    for (const f of r.flags) summary[f] = (summary[f] ?? 0) + 1;
  }
  process.stdout.write(
    `${JSON.stringify({ checked: results.length, date: TODAY, summary }, null, 2)}\n`
  );

  if (OUT) writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);

  if (WRITE) {
    const byDomain = new Map(results.map((r) => [r.domain, r]));
    for (const row of data.destinations) {
      const r = byDomain.get(row.domain);
      if (!r) continue;
      row.measured = TODAY;
      row.flags = row.flags.filter((f) => !MEASURED_FLAGS.includes(f));
      for (const f of r.flags) if (!row.flags.includes(f)) row.flags.push(f);
      // A measured nofollow beats a source claim of follow.
      if (r.flags.includes('Example link observed nofollow')) row.link = 'nofollow';
      if (r.flags.includes('Example link verified follow') && row.link === 'unknown') {
        row.link = 'follow';
      }
    }
    // Preserve the dataset's compact-flags formatting convention.
    const serialized = JSON.stringify(data, null, 2).replace(
      /"flags": \[\n(.*?)\n {6}\]/gs,
      (match, inner) => {
        const items = [...inner.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
        const inline = `"flags": [${items.map((i) => `"${i}"`).join(', ')}]`;
        return inline.length + 6 <= 100 ? inline : match;
      }
    );
    writeFileSync(DATASET, `${serialized}\n`);
    process.stderr.write('dataset updated (flags + measured stamp)\n');
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
});
