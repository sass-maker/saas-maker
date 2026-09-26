#!/usr/bin/env node
/**
 * catalog-freshness — report on how stale the public catalogs have become,
 * and optionally probe whether launch destinations are still alive.
 *
 * Why this exists: launchdesk.json and funding.json are snapshots. Domains
 * get hijacked, directories pivot to paid, deadlines pass — and nothing in
 * the static site notices. The research backlog already proved this: the
 * drain found gambling hijacks, rebrands, and free→paid drift that the seed
 * claims carried for months. This script is the standing check so that drift
 * surfaces on a cadence instead of silently accruing.
 *
 * Two modes, deliberately separated:
 *
 *   Default (offline, zero network):
 *     - funding.json: expired or imminent `Deadline` dates, `Last Verified`
 *       older than --stale-days, programs still marked `Open now` whose
 *       deadline already passed
 *     - launchdesk.json: destinations whose newest claim/playbook research is
 *       older than --stale-days, quarantine coverage stats, claim conflicts
 *       (sources disagree on pricing or link policy)
 *     - playbooks: per-domain `retrieved` staleness from the playbook corpus
 *
 *   --probe (network, opt-in):
 *     - GET each active destination homepage with a timeout and bounded
 *       concurrency; classify alive / dead (DNS, 4xx, 5xx, timeout) /
 *       redirected (cross-origin move, records the new host) / parked
 *       (heuristic title sniff). Probing never mutates the dataset — it
 *       writes a report an operator or agent merges after review, the same
 *       contract the research agents followed.
 *
 * Usage:
 *   node scripts/catalog-freshness.mjs                    # offline report
 *   node scripts/catalog-freshness.mjs --probe --limit 40 # spot-check 40
 *   node scripts/catalog-freshness.mjs --probe            # full probe (slow)
 *   node scripts/catalog-freshness.mjs --out report.md    # markdown report
 *
 * Boundaries: no credentials, no response-body persistence beyond a <title>
 * sniff in the report, no dataset mutation. Read-only against the catalog.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '..', '..');
const SHOWCASE_DATA = resolve(REPOSITORY_ROOT, 'apps/showcase/src/data');
const LAUNCHDESK_PATH = resolve(SHOWCASE_DATA, 'launchdesk.json');
const PLAYBOOK_DIR = resolve(SHOWCASE_DATA, 'launchdesk-playbooks');
const FUNDING_PATH = resolve(SHOWCASE_DATA, 'funding.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const PROBE = flag('probe');
const LIMIT = Number(opt('limit', '0')) || Infinity;
const CONCURRENCY = Number(opt('concurrency', '8'));
const STALE_DAYS = Number(opt('stale-days', '90'));
const OUT = opt('out', null);
const TODAY = new Date().toISOString().slice(0, 10);
const STALE_BEFORE = new Date(Date.now() - STALE_DAYS * 864e5).toISOString().slice(0, 10);

const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
const daysAgo = (date) => Math.floor((Date.now() - new Date(date)) / 864e5);

// ---------- launchdesk offline scan ----------

function launchdeskOffline() {
  const data = load(LAUNCHDESK_PATH);
  const rows = data.destinations ?? [];
  const active = rows.filter((r) => !r.quarantined);
  const quarantined = rows.filter((r) => r.quarantined);

  // playbook retrieved dates by domain
  const playbookAge = new Map();
  if (existsSync(PLAYBOOK_DIR)) {
    for (const file of readdirSync(PLAYBOOK_DIR)) {
      if (!file.endsWith('.json') || file.startsWith('_')) continue;
      try {
        const pb = JSON.parse(readFileSync(resolve(PLAYBOOK_DIR, file), 'utf8'));
        if (pb.domain && pb.retrieved) playbookAge.set(pb.domain, pb.retrieved);
      } catch {
        // malformed playbook files are the validator's job, not ours
      }
    }
  }

  const stale = [];
  const claimConflicts = [];
  for (const row of active) {
    const research = (row.claims ?? [])
      .filter((c) => c.retrieved)
      .map((c) => c.retrieved)
      .sort()
      .pop();
    const freshest = [row.measured, row.retrieved, playbookAge.get(row.domain), research]
      .filter(Boolean)
      .sort()
      .pop();
    if (!freshest || freshest < STALE_BEFORE) {
      stale.push({
        domain: row.domain,
        freshest: freshest ?? 'never',
        ageDays: freshest ? daysAgo(freshest) : null,
        hasPlaybook: playbookAge.has(row.domain),
      });
    }
    // pricing/link disagreements between sources are drift candidates
    const claims = row.claims ?? [];
    const pricing = [...new Set(claims.map((c) => c.pricing).filter(Boolean))];
    const links = [...new Set(claims.map((c) => c.link).filter(Boolean))];
    if (pricing.length > 1 || links.length > 1) {
      claimConflicts.push({ domain: row.domain, pricing, links });
    }
  }
  stale.sort((a, b) => (b.ageDays ?? 9999) - (a.ageDays ?? 9999));
  return {
    snapshot: data.snapshot,
    totals: { rows: rows.length, active: active.length, quarantined: quarantined.length },
    staleCount: stale.length,
    stale: stale.slice(0, 50),
    claimConflictCount: claimConflicts.length,
    claimConflicts: claimConflicts.slice(0, 30),
  };
}

// ---------- funding offline scan ----------

function fundingOffline() {
  const data = load(FUNDING_PATH);
  const name2key = Object.fromEntries(
    Object.entries(data.schema).map(([k, v]) => [v.name, k]),
  );
  const f = (p, name) => p.fields?.[name2key[name]] ?? null;

  const expired = [];
  const expiring = [];
  const staleVerify = [];
  for (const p of data.programs) {
    const deadline = f(p, 'Deadline');
    const status = f(p, 'External Status');
    const verified = f(p, 'Last Verified');
    if (deadline && /^\d{4}-\d{2}-\d{2}/.test(String(deadline))) {
      const entry = { slug: p.slug, name: p.name, deadline, status };
      if (deadline < TODAY) expired.push(entry);
      else if (daysAgo(deadline) > -30) expiring.push(entry);
    }
    if (verified && String(verified) < STALE_BEFORE) {
      staleVerify.push({ slug: p.slug, name: p.name, lastVerified: verified });
    }
  }
  const stillOpen = expired.filter((e) => e.status === 'Open now');
  return {
    totals: { programs: data.programs.length },
    expired,
    expiringNext30d: expiring,
    expiredButStillOpen: stillOpen,
    staleVerifyCount: staleVerify.length,
    staleVerify: staleVerify.slice(0, 50),
  };
}

// ---------- live probe ----------

const PARKED_TITLE = /domain (is )?(for sale|parked)|buy this domain|hugedomains|dan\.com|sedo|afternic|free parking/i;
const HIJACK_TITLE = /casino|slot|betting|toto|gambl|카지노|바카라|porn|xxx|viagra|crypto.*(casino|bet)/i;

async function probeOne(row) {
  const url = row.website ?? `https://${row.domain}/`;
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'SaaS-Maker-Catalog-Freshness/1.0 (+sassmaker.com)' },
    });
    clearTimeout(timer);
    const finalUrl = res.url;
    const finalHost = new URL(finalUrl).hostname.replace(/^www\./, '');
    const origHost = new URL(url).hostname.replace(/^www\./, '');
    const html = res.ok ? (await res.text()).slice(0, 200_000) : '';
    const title = /<title[^>]*>([^<]{0,300})/i.exec(html)?.[1] ?? '';

    let verdict = 'alive';
    if (!res.ok) verdict = res.status === 404 || res.status >= 500 ? 'dead' : `http-${res.status}`;
    else if (finalHost !== origHost && !finalHost.endsWith(`.${origHost}`))
      verdict = 'redirected';
    else if (PARKED_TITLE.test(title)) verdict = 'parked?';
    else if (HIJACK_TITLE.test(title)) verdict = 'hijacked?';

    return {
      domain: row.domain,
      status: res.status,
      verdict,
      finalUrl: verdict === 'redirected' ? finalUrl : undefined,
      title: title.trim().slice(0, 120) || undefined,
      ms: Date.now() - started,
    };
  } catch (err) {
    const dead = /ENOTFOUND|getaddrinfo/i.test(String(err?.cause ?? err));
    return {
      domain: row.domain,
      verdict: dead ? 'dead-dns' : 'dead-timeout',
      error: String(err?.cause?.code ?? err?.name ?? err).slice(0, 80),
      ms: Date.now() - started,
    };
  }
}

async function probe() {
  const data = load(LAUNCHDESK_PATH);
  const active = (data.destinations ?? []).filter((r) => !r.quarantined);
  const targets = active.slice(0, LIMIT === Infinity ? active.length : LIMIT);
  const results = [];
  const queue = [...targets];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) results.push(await probeOne(queue.shift()));
    }),
  );
  const bad = results.filter((r) => r.verdict !== 'alive');
  return {
    probed: results.length,
    summary: Object.fromEntries(
      [...new Set(results.map((r) => r.verdict))].map((v) => [
        v,
        results.filter((r) => r.verdict === v).length,
      ]),
    ),
    needsAttention: bad.sort((a, b) => a.domain.localeCompare(b.domain)),
  };
}

// ---------- report ----------

const report = {
  generated: new Date().toISOString(),
  staleThresholdDays: STALE_DAYS,
  launchdesk: launchdeskOffline(),
  funding: fundingOffline(),
  probe: PROBE ? await probe() : 'skipped (pass --probe)',
};

function toMarkdown(r) {
  const ld = r.launchdesk;
  const fd = r.funding;
  const lines = [
    `# Catalog freshness — ${TODAY}`,
    '',
    `## LaunchDesk`,
    `- ${ld.totals.active} active / ${ld.totals.quarantined} quarantined (snapshot ${ld.snapshot})`,
    `- **${ld.staleCount} destinations** with no verification in the last ${r.staleThresholdDays} days`,
    `- ${ld.claimConflictCount} destinations have conflicting source claims (pricing/link policy)`,
    '',
  ];
  if (ld.stale.length) {
    lines.push('Stalest destinations:', '');
    for (const s of ld.stale.slice(0, 15)) {
      lines.push(`- \`${s.domain}\` — last verified ${s.freshest}${s.hasPlaybook ? '' : ' (no playbook)'}`);
    }
    lines.push('');
  }
  lines.push('## Funding', '');
  if (fd.expiredButStillOpen.length) {
    lines.push(`**${fd.expiredButStillOpen.length} programs still marked "Open now" with a passed deadline:**`, '');
    for (const e of fd.expiredButStillOpen) lines.push(`- ${e.name} — deadline ${e.deadline}`);
    lines.push('');
  }
  lines.push(`- ${fd.expired.length} deadlines passed, ${fd.expiringNext30d.length} expire within 30 days`);
  lines.push(`- ${fd.staleVerifyCount} programs not verified in ${r.staleThresholdDays}+ days`, '');
  if (typeof r.probe === 'object') {
    lines.push('## Live probe', '');
    lines.push(`- ${r.probe.probed} destinations probed: ${JSON.stringify(r.probe.summary)}`, '');
    for (const b of r.probe.needsAttention.slice(0, 40)) {
      lines.push(`- \`${b.domain}\` — **${b.verdict}**${b.finalUrl ? ` → ${b.finalUrl}` : ''}${b.title ? ` "${b.title}"` : ''}`);
    }
  } else {
    lines.push('## Live probe — skipped', '', 'Run with `--probe` for liveness checks.');
  }
  return lines.join('\n');
}

if (OUT) {
  writeFileSync(resolve(OUT), toMarkdown(report));
  console.log(`wrote ${OUT}`);
} else {
  console.log(JSON.stringify(report, null, 1));
}
