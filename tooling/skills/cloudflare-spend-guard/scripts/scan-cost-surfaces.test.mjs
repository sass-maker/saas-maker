import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { scanFleetCostSurfaces } from './scan-cost-surfaces.mjs';

test('maps tracked Wrangler bindings as configuration-only exposure', () => {
  const root = mkdtempSync(join(tmpdir(), 'cloudflare-spend-guard-'));
  try {
    mkdirSync(join(root, 'site-health/apps/backend/config'), { recursive: true });
    mkdirSync(join(root, 'app'), { recursive: true });
    writeFileSync(join(root, 'site-health/apps/backend/config/projects.json'), JSON.stringify({
      projects: [{
        id: 'example',
        family: 'example',
        tier: 'active',
        status: 'live',
        repo: 'app',
        deployKind: 'worker+pages',
        cfProject: 'example-worker',
        d1Databases: ['example-db'],
        databaseResources: [
          { provider: 'cloudflare-d1', name: 'example-db', state: 'prepared' },
        ],
        domains: ['example.com'],
      }],
    }));
    writeFileSync(join(root, 'app/wrangler.jsonc'), `{
      "name": "example-worker",
      "d1_databases": [{ "binding": "DB", "database_name": "example-db" }],
      "r2_buckets": [{ "binding": "FILES", "bucket_name": "example-files" }],
      "queues": { "consumers": [{ "queue": "example-jobs" }] },
      "ai": { "binding": "AI" },
      "triggers": { "crons": ["0 * * * *"] },
      "limits": { "cpu_ms": 1000 },
    }\n`);
    mkdirSync(join(root, 'app/functions'), { recursive: true });
    writeFileSync(join(root, 'app/functions/api.ts'), 'export const onRequest = () => new Response("ok");\n');
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', [
      'add',
      'site-health/apps/backend/config/projects.json',
      'app/wrangler.jsonc',
      'app/functions/api.ts',
    ], { cwd: root });

    const report = scanFleetCostSurfaces({ fleetRoot: root });
    const project = report.projects[0];
    const products = project.costSurfaces.map((surface) => surface.product);

    assert.equal(report.evidence, 'configuration-only');
    assert.deepEqual(products, [
      'd1',
      'pages',
      'pages-functions',
      'queues',
      'r2',
      'workers',
      'workers-ai',
    ]);
    assert.equal(project.configs[0].signals.scheduled, true);
    assert.equal(project.configs[0].signals.cpuLimitConfigured, true);
    assert.deepEqual(project.declared.d1Databases, ['example-db']);
    assert.deepEqual(project.declared.databaseResources, [
      { provider: 'cloudflare-d1', name: 'example-db', state: 'prepared' },
    ]);
    assert.deepEqual(
      project.costSurfaces.find((surface) => surface.product === 'd1').identifiers,
      ['DB', 'example-db'],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects an unknown project filter', () => {
  const root = mkdtempSync(join(tmpdir(), 'cloudflare-spend-guard-'));
  try {
    mkdirSync(join(root, 'site-health/apps/backend/config'), { recursive: true });
    writeFileSync(join(root, 'site-health/apps/backend/config/projects.json'), '{"projects":[]}');
    assert.throws(
      () => scanFleetCostSurfaces({ fleetRoot: root, projectId: 'missing' }),
      /Unknown Fleet project/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects invalid database resource states', () => {
  const root = mkdtempSync(join(tmpdir(), 'cloudflare-spend-guard-'));
  try {
    mkdirSync(join(root, 'site-health/apps/backend/config'), { recursive: true });
    writeFileSync(join(root, 'site-health/apps/backend/config/projects.json'), JSON.stringify({
      projects: [{
        id: 'invalid',
        databaseResources: [{ provider: 'cloudflare-d1', name: 'example-db', state: 'retired' }],
      }],
    }));
    assert.throws(
      () => scanFleetCostSurfaces({ fleetRoot: root }),
      /invalid state/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
