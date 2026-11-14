import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { appHealthMonitoringManifests } from './app-health-monitoring-policy.mjs';

const journey = {
  journey: 'home',
  url: 'https://example.com/',
  budget_ms: 3000,
  expect: { content_type: 'text/html', body_includes: ['Example'] },
};
function project(id, probe, status = 'active') {
  return {
    id,
    name: id,
    lifecycle: { portfolioStatus: status },
    systems: { probe },
  };
}

test('all current projects survive projection, including local and private exemptions', () => {
  const projects = Array.from({ length: 38 }, (_, i) =>
    project(`public-${i}`, { journeys: [journey] })
  );
  projects.push(
    project('local-tool', {
      scope: 'local',
      absent: 'Runs only on the operator machine.',
    }),
    project('private-tool', {
      scope: 'private',
      absent: 'Private content stays outside telemetry.',
    }),
    project('old', { journeys: [journey] }, 'inactive')
  );
  const result = appHealthMonitoringManifests({ projects });
  assert.equal(result.coverage.projects.length, 40);
  assert.equal(result.probes.journeys.length, 38);
  assert.deepEqual(result.coverage.projects.at(-1), {
    catalog_id: 'private-tool',
    name: 'private-tool',
    scope: 'private',
    reason: 'Private service; hosted telemetry and public synthetic checks are disabled.',
    journeys: [],
  });
  assert.ok(!JSON.stringify(result).includes('"old"'));
  assert.ok(!Object.hasOwn(result.coverage.projects[0], 'url'));
});

test('missing policy and ambiguous exemptions cannot silently disappear', () => {
  for (const probe of [
    undefined,
    { absent: 'Not configured' },
    { scope: 'private', absent: '' },
    { scope: 'private', absent: 'Private', journeys: [journey] },
  ]) {
    assert.throws(() => appHealthMonitoringManifests({ projects: [project('x', probe)] }));
  }
});

test('public probes reject credentials, queries, local addresses and non-GET fields', () => {
  for (const url of [
    'https://example.com/?token=secret',
    'https://user:pass@example.com/',
    'http://example.com/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://example.local/',
    'https://example.com/#secret',
  ]) {
    assert.throws(() =>
      appHealthMonitoringManifests({
        projects: [
          project('x', {
            journeys: [{ ...journey, url }],
          }),
        ],
      })
    );
  }
  assert.throws(() =>
    appHealthMonitoringManifests({
      projects: [
        project('x', {
          journeys: [{ ...journey, method: 'POST' }],
        }),
      ],
    })
  );
});

test('duplicate project and journey identities fail instead of conflating coverage', () => {
  assert.throws(
    () =>
      appHealthMonitoringManifests({
        projects: [project('x', { journeys: [journey] }), project('x', { journeys: [journey] })],
      }),
    /duplicate/
  );
  assert.throws(
    () =>
      appHealthMonitoringManifests({
        projects: [project('x', { journeys: [journey, journey] })],
      }),
    /duplicate/
  );
});

test('private scope cannot be converted into a public probe when its reason is missing', () => {
  for (const scope of ['local', 'private'])
    assert.throws(() =>
      appHealthMonitoringManifests({ projects: [project('x', { scope, journeys: [journey] })] })
    );
});

test('trailing-dot and private network hostnames stay outside public probes', () => {
  for (const url of [
    'https://localhost./',
    'https://router.lan/',
    'https://app.home.arpa/',
    'https://app.localdomain/',
    'https://app.internal./',
    'https://app.test/',
    'https://app.corp/',
  ])
    assert.throws(() =>
      appHealthMonitoringManifests({
        projects: [project('x', { journeys: [{ ...journey, url }] })],
      })
    );
});

test('identities fit the probe runtime limit before manifests are emitted', () => {
  assert.throws(() =>
    appHealthMonitoringManifests({ projects: [project('x'.repeat(65), { journeys: [journey] })] })
  );
  assert.throws(() =>
    appHealthMonitoringManifests({
      projects: [project('x', { journeys: [{ ...journey, journey: 'x'.repeat(65) }] })],
    })
  );
});

test('journeys retain reviewed policy order and append newly registered projects', () => {
  const result = appHealthMonitoringManifests({
    systems: { probeJourneys: { order: ['b', 'old', 'a'] } },
    projects: [
      project('a', { journeys: [journey] }),
      project('b', { journeys: [journey] }),
      project('c', { journeys: [journey] }),
      project('old', { journeys: [journey] }, 'inactive'),
    ],
  });
  assert.deepEqual(
    result.probes.journeys.map((row) => row.project),
    ['b', 'a', 'c']
  );
  assert.deepEqual(
    result.coverage.projects.map((row) => row.catalog_id),
    ['a', 'b', 'c']
  );
});

test('the generated file never exceeds the runtime-wide journey capacity', () => {
  const projects = Array.from({ length: 21 }, (_, i) =>
    project(`p-${i}`, {
      journeys: Array.from({ length: 10 }, (_, j) => ({ ...journey, journey: `check-${j}` })),
    })
  );
  assert.throws(() => appHealthMonitoringManifests({ projects }), /200/);
});

test('private catalog exemption notes do not enter the public projection', () => {
  const result = appHealthMonitoringManifests({
    projects: [
      project('x', {
        scope: 'private',
        absent: 'Internal infrastructure notes and private provider context.',
      }),
    ],
  });
  assert.ok(!JSON.stringify(result).includes('Internal infrastructure'));
  assert.ok(result.coverage.projects[0].reason.length > 0);
});

test('non-string identities and URLs are rejected before a runtime-invalid file is emitted', () => {
  for (const invalid of [
    { ...journey, journey: 1 },
    { ...journey, url: { toString: () => 'https://example.com/' } },
  ])
    assert.throws(() =>
      appHealthMonitoringManifests({ projects: [project('x', { journeys: [invalid] })] })
    );
});

test('standalone generation keeps the complete roster in the ignored owner-local directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'monitoring-projection-'));
  try {
    const repo = join(root, 'saas-maker');
    const target = join(root, 'app-health');
    for (const path of [join(repo, 'scripts'), join(repo, 'catalog'), join(target, 'apps/probe')])
      mkdirSync(path, { recursive: true });
    for (const name of [
      'sync-app-health-monitoring.mjs',
      'app-health-monitoring-policy.mjs',
      'catalog-paths.mjs',
    ])
      cpSync(new URL(name, import.meta.url), join(repo, 'scripts', name));
    writeFileSync(
      join(repo, 'catalog/projects.json'),
      JSON.stringify({
        projects: [
          project('public-tool', { journeys: [journey] }),
          project('private-tool', {
            scope: 'private',
            absent: 'Owner-only infrastructure context.',
          }),
        ],
      })
    );
    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: 'app-health' }));
    const run = (...args) =>
      spawnSync(
        process.execPath,
        [join(repo, 'scripts/sync-app-health-monitoring.mjs'), '--target', target, ...args],
        { cwd: repo, encoding: 'utf8' }
      );
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    const policy = JSON.parse(
      readFileSync(join(target, '.fleet-local/monitoring-policy.json'), 'utf8')
    );
    assert.equal(policy.projects.length, 2);
    assert.equal(existsSync(join(target, 'apps/probe/coverage.json')), false);
    assert.ok(
      !readFileSync(join(target, 'apps/probe/journeys.json'), 'utf8').includes('private-tool')
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
