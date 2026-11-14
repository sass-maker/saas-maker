import test from 'node:test';
import assert from 'node:assert/strict';
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
    reason: 'Private content stays outside telemetry.',
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
