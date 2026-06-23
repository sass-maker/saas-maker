#!/usr/bin/env node
/**
 * Verify PostHog fleet events are filterable by project_id after the canonical migration.
 *
 * Usage:
 *   pnpm fleet:posthog-verify
 *   pnpm fleet:posthog-verify -- --json --fail-on-gap
 *
 * Credentials: POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID env vars, or
 * apps/cockpit/.env.local (same as fleet supervisor).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ENV_PATH = path.join(ROOT, 'apps', 'cockpit', '.env.local');
const POSTHOG_HOST = (process.env.POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');

const PROJECT_ID_COALESCE =
  'coalesce(properties.project_id, properties.project_slug, properties.project, properties.foundry_project_id)';

const TAXONOMY_EVENTS = ['signup', 'activated', 'core_action', 'returned'];
const FOUNDRY_EVENTS = [
  'foundry_error',
  'foundry_trace',
  'foundry_page_crash',
  'foundry_auth_failure',
  'foundry_signup_failure',
];
const ALL_EVENTS = [...TAXONOMY_EVENTS, ...FOUNDRY_EVENTS];

function parseArgs(argv) {
  const args = { json: false, failOnGap: false, days: 30 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--fail-on-gap') args.failOnGap = true;
    else if (arg === '--days') args.days = Number(argv[++i] ?? 30);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Fleet PostHog project_id verification

Usage:
  pnpm fleet:posthog-verify
  pnpm fleet:posthog-verify -- --json --fail-on-gap --days 30
`);
      process.exit(0);
    }
  }
  return args;
}

function loadCredentials() {
  let apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  let projectId = process.env.POSTHOG_PROJECT_ID;

  if ((!apiKey || !projectId) && fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const keyMatch = envContent.match(/POSTHOG_PERSONAL_API_KEY="?([^"\n]+)"?/);
    const projMatch = envContent.match(/POSTHOG_PROJECT_ID="?([^"\n]+)"?/);
    if (keyMatch) apiKey = keyMatch[1];
    if (projMatch) projectId = projMatch[1];
  }

  return { apiKey, projectId };
}

async function runHogQL(apiKey, projectId, query) {
  const url = `${POSTHOG_HOST}/api/projects/${projectId}/query/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.results ?? [];
}

function eventListSql(events) {
  return events.map((e) => `'${e.replace(/'/g, "''")}'`).join(', ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { apiKey, projectId } = loadCredentials();

  if (!apiKey || !projectId) {
    console.error(
      'Missing PostHog credentials. Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID or apps/cockpit/.env.local'
    );
    process.exit(2);
  }

  const eventFilter = eventListSql(ALL_EVENTS);
  const rows = await runHogQL(
    apiKey,
    projectId,
    `
      SELECT
        event,
        count() AS total,
        countIf(notEmpty(toString(properties.project_id))) AS with_canonical_project_id,
        countIf(notEmpty(toString(${PROJECT_ID_COALESCE}))) AS with_coalesced_project_id,
        uniq(toString(${PROJECT_ID_COALESCE})) AS distinct_projects
      FROM events
      WHERE event IN (${eventFilter})
        AND timestamp >= now() - INTERVAL ${args.days} DAY
      GROUP BY event
      ORDER BY event
    `
  );

  const byEvent = new Map(rows.map((row) => [row[0], row]));
  const results = ALL_EVENTS.map((event) => {
    const row = byEvent.get(event);
    const total = Number(row?.[1] ?? 0);
    const withCanonical = Number(row?.[2] ?? 0);
    const withCoalesced = Number(row?.[3] ?? 0);
    const distinctProjects = Number(row?.[4] ?? 0);
    const coverage =
      total === 0
        ? 'no_events'
        : withCoalesced === total
          ? 'full'
          : withCoalesced > 0
            ? 'partial'
            : 'missing';
    return {
      event,
      group: TAXONOMY_EVENTS.includes(event) ? 'taxonomy' : 'foundry',
      total,
      with_canonical_project_id: withCanonical,
      with_coalesced_project_id: withCoalesced,
      distinct_projects: distinctProjects,
      coverage,
      filterable: coverage === 'full' || coverage === 'partial',
    };
  });

  const gaps = results.filter((r) => r.total > 0 && r.coverage !== 'full');
  const noTraffic = results.filter((r) => r.total === 0);
  const ok = gaps.length === 0;

  const report = {
    ok,
    window_days: args.days,
    project_id_coalesce: PROJECT_ID_COALESCE,
    dashboard_filter_hint: `Use HogQL property: ${PROJECT_ID_COALESCE} AS project_id`,
    summary: {
      events_checked: results.length,
      events_with_traffic: results.length - noTraffic.length,
      events_without_traffic: noTraffic.length,
      gaps: gaps.length,
    },
    results,
    gaps,
    no_traffic: noTraffic.map((r) => r.event),
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`PostHog fleet project_id verification (last ${args.days} days)`);
    console.log(`Filter expression: ${PROJECT_ID_COALESCE}`);
    console.log('');
    for (const row of results) {
      const status =
        row.total === 0
          ? '—'
          : row.coverage === 'full'
            ? 'OK'
            : row.coverage === 'partial'
              ? 'PARTIAL'
              : 'GAP';
      console.log(
        `${status.padEnd(8)} ${row.event.padEnd(24)} total=${String(row.total).padStart(6)} canonical=${String(row.with_canonical_project_id).padStart(6)} coalesced=${String(row.with_coalesced_project_id).padStart(6)} projects=${row.distinct_projects}`
      );
    }
    if (gaps.length > 0) {
      console.log('\nGaps (events with traffic but incomplete project_id):');
      for (const g of gaps) {
        console.log(
          `  - ${g.event}: ${g.with_coalesced_project_id}/${g.total} coalesced, ${g.with_canonical_project_id}/${g.total} canonical`
        );
      }
    }
    if (noTraffic.length > 0) {
      console.log(
        `\nNo events in window (${noTraffic.length}): ${noTraffic.map((r) => r.event).join(', ')}`
      );
    }
    console.log(`\nOverall: ${ok ? 'PASS' : 'FAIL'} (${gaps.length} gap(s))`);
  }

  if (args.failOnGap && !ok) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
