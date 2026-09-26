#!/usr/bin/env node
/**
 * Fleet SEO scoreboard — the measure + select + register spine of the `seo`
 * skill. Credential-free: reads only local Fleet ledgers, never a provider.
 *
 * Panels:
 *   Search Console  ~/.fleet/visibility-outcomes/ledger.jsonl (site-health collect)
 *   Indexing        ~/.fleet/search-indexing-requests/{ledger,results}.jsonl
 *   Human traffic   site-health Clarity cached snapshot (optional, no network)
 *   Actions taken   ~/.fleet/seo-ops/runs.jsonl (what this tool registered)
 *
 * Commands:
 *   scoreboard [--project <id>] [--format markdown|json]
 *   register --project <id> --lane <lane> --summary "what was done" [--target <url> ...]
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FLEET_ROOT = resolve(REPO_ROOT, '../..');
const HOME = homedir();
const OUTCOMES_PATH = join(HOME, '.fleet', 'visibility-outcomes', 'ledger.jsonl');
const INDEX_REQUESTS_PATH = join(HOME, '.fleet', 'search-indexing-requests', 'ledger.jsonl');
const INDEX_RESULTS_PATH = join(HOME, '.fleet', 'search-indexing-requests', 'results.jsonl');
const RUNS_PATH = join(HOME, '.fleet', 'seo-ops', 'runs.jsonl');
const RUNS_SCHEMA = 'fleet.seo-run.v1';
const LANES = new Set([
  'fix', 'refresh', 'editorial', 'programmatic', 'indexing',
  'aeo', 'technical', 'offpage', 'distribute', 'measure', 'brand', 'other',
]);

// Expected CTR by position, used to spot under-clicked page-1/2 terms.
const EXPECTED_CTR = (position) => {
  if (position <= 1.5) return 28;
  if (position <= 2.5) return 15;
  if (position <= 3.5) return 10;
  if (position <= 4.5) return 7;
  if (position <= 7) return 4;
  if (position <= 10) return 2;
  if (position <= 20) return 1;
  return 0;
};

const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  const v = args[i + 1];
  return i >= 0 && v && !v.startsWith('--') ? v : null;
};
const optAll = (name) => {
  const values = [];
  args.forEach((arg, i) => {
    if (arg === name && args[i + 1] && !args[i + 1].startsWith('--')) values.push(args[i + 1]);
  });
  return values;
};

function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
}

function metric(observation, label) {
  return Number(observation?.metrics?.find((m) => m.label === label)?.value ?? 0);
}

/** Latest search observation per project. */
function latestSearch() {
  const latest = new Map();
  for (const row of readJsonl(OUTCOMES_PATH)) {
    if (row.family !== 'search' || typeof row.projectId !== 'string') continue;
    const prev = latest.get(row.projectId);
    if (!prev || row.observedAt > prev.observedAt) latest.set(row.projectId, row);
  }
  return latest;
}

/** Indexing lifecycle counts per project, mirroring indexing-requests.mjs classify(). */
const FINAL_AGE_MS = 14 * 24 * 60 * 60 * 1000;
function indexingCounts(now = Date.now()) {
  const requests = readJsonl(INDEX_REQUESTS_PATH);
  const results = readJsonl(INDEX_RESULTS_PATH);
  const latest = new Map();
  for (const r of requests) {
    const key = `${r.projectId} ${r.inspectedUrl}`;
    const prev = latest.get(key);
    if (!prev || r.requestedAt > prev.requestedAt) latest.set(key, r);
  }
  const counts = new Map();
  for (const request of latest.values()) {
    const seen = results
      .filter((r) => `${r.projectId} ${r.inspectedUrl}` === `${request.projectId} ${request.inspectedUrl}`
        && Date.parse(r.checkedAt) >= Date.parse(request.requestedAt))
      .sort((a, b) => Date.parse(a.checkedAt) - Date.parse(b.checkedAt));
    const last = seen[seen.length - 1];
    const age = now - Date.parse(request.requestedAt);
    let state;
    if (seen.some((r) => r.state === 'indexed')) state = 'indexed';
    else if (!last) state = 'queued';
    else if (last.state === 'unavailable') state = 'unavailable';
    else if (age >= FINAL_AGE_MS) state = 'not-indexed';
    else state = 'checking';
    const bucket = counts.get(request.projectId) ?? {
      total: 0, queued: 0, checking: 0, indexed: 0, 'not-indexed': 0, unavailable: 0,
      lastCrawled: null, coverage: {},
    };
    bucket.total += 1;
    bucket[state] += 1;
    if (last?.coverageState) bucket.coverage[last.coverageState] = (bucket.coverage[last.coverageState] ?? 0) + 1;
    if (last?.lastCrawlTime && (!bucket.lastCrawled || last.lastCrawlTime > bucket.lastCrawled)) {
      bucket.lastCrawled = last.lastCrawlTime;
    }
    counts.set(request.projectId, bucket);
  }
  return counts;
}

/** Cached Clarity snapshot per project — optional panel, fails soft. */
function clarityCounts() {
  const script = join(FLEET_ROOT, 'site-health', 'apps', 'backend', 'scripts', 'clarity-collect.mjs');
  if (!existsSync(script)) return new Map();
  const run = spawnSync(process.execPath, [script, 'status-all'], {
    encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const start = (run.stdout ?? '').indexOf('{');
  if (start < 0) return new Map();
  let parsed;
  try { parsed = JSON.parse(run.stdout.slice(start)); } catch { return new Map(); }
  const map = new Map();
  for (const result of parsed.results ?? []) {
    const metrics = result.metrics ?? {};
    map.set(result.projectId, {
      classification: result.classification,
      sessions: metrics.sessions ?? metrics.totalSessions ?? null,
      browsers: metrics.uniqueBrowsers ?? metrics.distinctUsers ?? null,
      bots: metrics.botSessions ?? metrics.botTraffic ?? null,
    });
  }
  return map;
}

function readRuns() {
  return readJsonl(RUNS_PATH).filter((r) => r.schemaVersion === RUNS_SCHEMA);
}

/** Rough priority rubric — one scale across lanes, highest first. */
function rankCandidates(vitals) {
  const candidates = [];
  const add = (score, lane, action, evidence) =>
    candidates.push({ score: Math.round(score), lane, action, evidence });

  const { gsc, indexing } = vitals;
  const impressions = gsc?.impressions ?? null;
  const clicks = gsc?.clicks ?? 0;
  const prevImpressions = gsc?.previousImpressions ?? null;
  const terms = gsc?.terms ?? [];

  if (gsc?.indexInspection === 'not-indexed') {
    add(120, 'fix', 'Homepage reports not-indexed — repair robots/noindex/canonical before anything else',
      gsc.coverageState ?? 'indexInspection verdict not-indexed');
  }
  if (indexing && indexing['not-indexed'] > 0) {
    const bad = Object.entries(indexing.coverage)
      .filter(([state]) => /redirect|robots|noindex|error|not found/i.test(state));
    if (bad.length) {
      add(110, 'technical', 'Fix structurally broken URLs that can never index',
        bad.map(([s, n]) => `${n}× ${s}`).join(', '));
    }
  }
  if (impressions != null && prevImpressions != null && prevImpressions >= 300 && impressions < prevImpressions * 0.6) {
    add(90 + (prevImpressions - impressions) / 500, 'technical',
      'Investigate impression collapse — pages may have dropped out or rankings slid',
      `impressions ${prevImpressions} → ${impressions} period over period`);
  }
  const striking = terms.filter((t) => t.position >= 4 && t.position <= 20 && t.impressions > 0);
  const strikingScore = striking.reduce(
    (sum, t) => sum + t.impressions * Math.max(0, EXPECTED_CTR(t.position) - t.ctr), 0);
  if (striking.length >= 3 && strikingScore > 0) {
    add(60 + Math.min(30, strikingScore / 10), 'refresh',
      `Refresh titles/snippets on ${striking.length} striking-distance terms (pos 4–20)`,
      striking.slice(0, 3).map((t) => `"${t.query}" pos ${t.position.toFixed(0)} ${t.impressions} imp`).join('; '));
  }
  if (impressions != null && impressions >= 3000 && clicks < impressions * 0.01) {
    add(70, 'refresh', 'Impressions without clicks — rewrite titles/snippets around the queries actually served',
      `${impressions} imp, ${clicks} clk, CTR ${(100 * clicks / impressions).toFixed(2)}%`);
  }
  if (indexing && (indexing.queued + indexing.checking) > 20) {
    const discovered = Object.entries(indexing.coverage)
      .filter(([s]) => /unknown|discovered|crawled - currently/i.test(s))
      .reduce((n, [, c]) => n + c, 0);
    add(50 + Math.min(20, (indexing.queued + indexing.checking) / 500), 'indexing',
      'Keep the indexing loop going; strengthen internal links toward discovered-but-unindexed pages',
      `${indexing.queued} queued, ${indexing.checking} checking, ${discovered} discovered-but-not-indexed`);
  }
  if (impressions != null && impressions > 0 && impressions < 25 && indexing && indexing.indexed > 0) {
    add(40, 'editorial', 'Indexed but no demand — ship pages that answer a real query (compare/alternative/use-case)',
      `${impressions} imp / 28d with ${indexing.indexed} indexed pages`);
  }
  if (clicks >= 20 || (impressions ?? 0) >= 500 && prevImpressions != null && impressions > prevImpressions * 1.5) {
    add(45, 'distribute', 'Double down on the winning pattern — more pages like the ones already earning clicks',
      `${clicks} clk, ${impressions} imp (prev ${prevImpressions})`);
  }
  if (impressions == null) {
    add(30, 'measure', 'No Search Console observation — verify property/domain mapping', 'no visibility-outcome row');
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function scoreboard() {
  const projectFilter = opt('--project');
  const format = opt('--format') ?? 'markdown';
  const gsc = latestSearch();
  const indexing = indexingCounts();
  const clarity = clarityCounts();
  const runs = readRuns();

  const projectIds = new Set([...gsc.keys(), ...indexing.keys(), ...runs.map((r) => r.projectId)]);
  const rows = [];
  for (const projectId of projectIds) {
    if (projectFilter && projectId !== projectFilter) continue;
    const observation = gsc.get(projectId);
    const vitals = {
      projectId,
      gsc: observation ? {
        observedAt: observation.observedAt,
        period: observation.period?.end?.slice(0, 10) ?? null,
        impressions: metric(observation, 'Search impressions'),
        clicks: metric(observation, 'Search clicks'),
        ctr: metric(observation, 'Search CTR'),
        position: metric(observation, 'Search average position') || null,
        previousImpressions: metric(observation.previousPeriod, 'Search impressions'),
        terms: (observation.searchTerms ?? []).map((t) => ({
          query: t.query, impressions: t.impressions, clicks: t.clicks,
          ctr: t.ctr, position: t.position,
        })),
        indexInspection: observation.indexInspection?.state ?? null,
        coverageState: observation.indexInspection?.coverageState ?? null,
      } : null,
      indexing: indexing.get(projectId) ?? null,
      clarity: clarity.get(projectId) ?? null,
    };
    vitals.candidates = rankCandidates(vitals);
    const actions = runs.filter((r) => r.projectId === projectId).map((run) => {
      const currentImp = vitals.gsc?.impressions ?? null;
      const baseImp = run.vitals?.impressions ?? null;
      return {
        ranAt: run.ranAt,
        lane: run.lane,
        summary: run.summary,
        targets: run.targets,
        impressionsThen: baseImp,
        impressionsNow: currentImp,
        clicksThen: run.vitals?.clicks ?? null,
        clicksNow: vitals.gsc?.clicks ?? null,
        outcome: baseImp != null && currentImp != null
          ? (currentImp > baseImp * 1.1 ? 'improving' : currentImp < baseImp * 0.9 ? 'declining' : 'flat')
          : 'unscored',
      };
    });
    rows.push({ ...vitals, actions });
  }
  rows.sort((a, b) => (b.gsc?.impressions ?? 0) - (a.gsc?.impressions ?? 0));

  if (format === 'json') {
    console.log(JSON.stringify({ schema: 'fleet.seo-scoreboard.v1', observedAt: new Date().toISOString(), rows }, null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log('No projects with search, indexing, or action evidence.');
    return;
  }
  console.log('# SEO scoreboard\n');
  console.log('| Project | Imp 28d | Δ prev | Clicks | CTR | Pos | Indexed/pending | Top candidate |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |');
  for (const row of rows) {
    const g = row.gsc;
    const idx = row.indexing;
    const delta = g && g.previousImpressions > 0
      ? `${Math.round((g.impressions - g.previousImpressions) / g.previousImpressions * 100)}%`
      : '—';
    const top = row.candidates[0];
    console.log(`| ${row.projectId} | ${g ? g.impressions : '—'} | ${delta} | ${g ? g.clicks : '—'} | ${g ? g.ctr.toFixed(1) + '%' : '—'} | ${g?.position ? g.position.toFixed(0) : '—'} | ${idx ? `${idx.indexed}/${idx.queued + idx.checking}` : '—'} | ${top ? `[${top.lane}] ${top.action.slice(0, 60)}` : '—'} |`);
  }
  console.log('\nRun `seo-scoreboard.mjs scoreboard --project <id> --format json` for candidates and action outcomes.');
}

function register() {
  const projectId = opt('--project');
  const lane = opt('--lane');
  const summary = opt('--summary');
  if (!projectId || !lane || !summary) {
    throw new Error('register requires --project, --lane, and --summary');
  }
  if (!LANES.has(lane)) throw new Error(`--lane must be one of: ${[...LANES].join(', ')}`);
  const observation = latestSearch().get(projectId);
  const idx = indexingCounts().get(projectId);
  const record = {
    schemaVersion: RUNS_SCHEMA,
    projectId,
    ranAt: new Date().toISOString(),
    lane,
    summary: summary.slice(0, 300),
    targets: optAll('--target').slice(0, 25),
    vitals: {
      impressions: observation ? metric(observation, 'Search impressions') : null,
      clicks: observation ? metric(observation, 'Search clicks') : null,
      position: observation ? metric(observation, 'Search average position') || null : null,
      indexed: idx?.indexed ?? null,
      pending: idx ? idx.queued + idx.checking : null,
    },
  };
  mkdirSync(dirname(RUNS_PATH), { recursive: true, mode: 0o700 });
  appendFileSync(RUNS_PATH, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(`Registered ${lane} action for ${projectId} → ${RUNS_PATH}`);
}

if (command === 'scoreboard') scoreboard();
else if (command === 'register') register();
else {
  console.error('Usage: seo-scoreboard.mjs <scoreboard|register> [options]');
  process.exit(1);
}
