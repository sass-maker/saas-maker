import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateDesignPolicies, validateProjectUi } from './design-policy-validation.mjs';

const policies = JSON.parse(
  readFileSync(new URL('../tooling/config/design-policy.json', import.meta.url))
);
const validate = (value) => validateDesignPolicies(value, []);

test('complete design policies are accepted; every top-level field is required', () => {
  assert.doesNotThrow(() => validate(policies));
  for (const [block, fields] of Object.entries(policies)) {
    const missingBlock = structuredClone(policies);
    delete missingBlock[block];
    assert.throws(() => validate(missingBlock), /Invalid design policy/);
    for (const key of Object.keys(fields)) {
      const copy = structuredClone(policies);
      delete copy[block][key];
      assert.throws(() => validate(copy), /Invalid design policy/);
    }
  }
});

test('provenance, real dates, tags, numeric thresholds and nested keys are checked', () => {
  for (const [path, value] of [
    ['uiLibrary.schemaVersion', 2],
    ['uiLibrary.currentTag', '0.1.19'],
    ['uiLibrary.currentTag', 'v1.2'],
    ['uiLibrary.web.packages', []],
    ['uiLibrary.source.quote', ' '],
    ['uiLibrary.source.date', ''],
    ['designDefaults.decidedAt', '2026-02-30'],
    ['designDefaults.decidedAt', '2026-13-01'],
    ['loadingStates.placeholderWithinMs', '300'],
    ['loadingStates.maxDataArrivalCls', -0.05],
    ['releaseGate.speed.maxLcpSeconds', NaN],
    ['releaseGate.speed.maxTbtMs', Infinity],
    ['releaseGate.speed.lighthouse.performance', 101],
    ['releaseGate.speed.runs', 2],
    ['releaseGate.ux.viewportWidths', [390, '768']],
    ['releaseGate.fleetContracts.minimumRouteProbes', 1.5],
    ['releaseGate.speed.unknown', true],
    ['releaseGate.source.unknown', 'future'],
  ]) {
    const copy = structuredClone(policies);
    const keys = path.split('.');
    const parent = keys.slice(0, -1).reduce((entry, key) => entry[key], copy);
    parent[keys.at(-1)] = value;
    assert.throws(() => validate(copy), /Invalid design policy/, path);
  }
  for (const key of Object.keys(policies)) {
    const copy = structuredClone(policies);
    copy[key].source = null;
    assert.throws(() => validate(copy), /Invalid design policy/);
  }
});

test('adoption is fully optional without defaults or conflating null with false', () => {
  for (const value of [
    undefined,
    {},
    { landing: {}, app: {}, native: {}, continuity: {} },
    { landing: { library: false, mode: null }, app: { library: true, mode: 'dark' } },
    { landing: { version: 'v0.1.19', template: 'gallery', mode: 'light' } },
    { native: { saasMakerUI: true, version: '0.1.17' } },
    ...[null, 0, 1, 2, 3].map((score) => ({ continuity: { score, checkedAt: '2026-10-11' } })),
  ]) {
    const original = structuredClone(value);
    assert.doesNotThrow(() => validateProjectUi(value, 'example'));
    assert.deepEqual(value, original);
  }
});

test('UI source observations retain unknowns and applicability without implying live coverage', () => {
  const unknown = {
    state: 'unknown',
    notes: 'Live behavior was not exercised; source evidence is retained separately.',
    checkedAt: '2026-10-14',
    evidence: ['src/app/loading.tsx:1'],
  };
  const value = {
    app: { mode: 'system', ...unknown, libraryVersion: unknown, loading: unknown },
    landing: { ...unknown, state: 'not-applicable' },
    continuity: { ...unknown, score: null },
  };
  assert.doesNotThrow(() => validateProjectUi(value, 'example'));
  for (const libraryVersion of [
    { ...unknown, state: 'source-observed' },
    { ...unknown, value: 'v0.1.19' },
    { state: 'unknown' },
  ]) {
    assert.throws(
      () => validateProjectUi({ app: { libraryVersion } }, 'example'),
      /Invalid design policy/
    );
  }
  assert.doesNotThrow(() =>
    validateProjectUi(
      { app: { libraryVersion: { ...unknown, state: 'source-observed', value: 'v0.1.19' } } },
      'example'
    )
  );
  for (const field of ['state', 'checkedAt', 'evidence']) {
    const copy = structuredClone(value);
    copy.app.loading[field] =
      field === 'state' ? 'covered' : field === 'checkedAt' ? 'yesterday' : [];
    assert.throws(() => validateProjectUi(copy, 'example'), /Invalid design policy/);
  }
});

test('adoption rejects invalid fields, objects, booleans, modes, scores and dates', () => {
  for (const value of [
    null,
    [],
    true,
    { unknown: {} },
    { landing: null },
    { app: [] },
    { landing: { library: 'true' } },
    { native: { saasMakerUI: null } },
    { app: { template: 'console' } },
    { landing: { mode: 'auto' } },
    { app: { version: 19 } },
    { continuity: { score: -1 } },
    { continuity: { score: 4 } },
    { continuity: { score: 1.5 } },
    { continuity: { notes: false } },
    { continuity: { checkedAt: '2026-02-30' } },
  ]) {
    assert.throws(() => validateProjectUi(value, 'example'), /projects.example.systems.ui/);
    assert.throws(
      () => validateDesignPolicies(policies, [{ id: 'example', systems: { ui: value } }]),
      /Invalid design policy/
    );
  }
});

test('worktree generation writes locally, preserves catalog order and checks drift', () => {
  const directory = mkdtempSync(join(tmpdir(), 'design-policy-'));
  const repo = join(directory, 'another-worktree-name');
  try {
    for (const path of ['scripts', 'catalog', 'tooling/config'])
      mkdirSync(join(repo, path), { recursive: true });
    for (const name of [
      'sync-catalog-systems.mjs',
      'design-policy-validation.mjs',
      'capture-policy-validation.mjs',
    ]) {
      cpSync(new URL(name, import.meta.url), join(repo, 'scripts', name));
    }
    const source = {
      systems: {
        ...policies,
        ...Object.fromEntries(
          [
            'clarity',
            'clarityJourneys',
            'geoObservatory',
            'aiVisibility',
            'psiPortfolioTargets',
            'sites',
            'probeJourneys',
          ].map((key) => [key, { order: [] }])
        ),
        capturePolicy: { schemaVersion: 1, purpose: 'Test', sourceIssue: 'Test', order: [] },
      },
      projects: [
        { id: 'z', systems: { ui: { app: { library: true, version: 'v0.1.19' } } } },
        { id: 'absent' },
        { id: 'a', systems: { ui: {} } },
      ],
    };
    writeFileSync(join(repo, 'catalog/projects.json'), JSON.stringify(source));
    const run = (...args) =>
      spawnSync(process.execPath, [join(repo, 'scripts/sync-catalog-systems.mjs'), ...args], {
        encoding: 'utf8',
      });
    const generated = run();
    assert.equal(generated.status, 0, generated.stderr);
    assert.match(generated.stdout, /skipped unavailable sibling manifest/);
    assert.deepEqual(
      JSON.parse(readFileSync(join(repo, 'tooling/config/design-policy.json'))),
      policies
    );
    assert.deepEqual(JSON.parse(readFileSync(join(repo, 'tooling/config/ui-adoption.json'))), {
      schemaVersion: 1,
      projects: [{ id: 'z', app: { library: true, version: 'v0.1.19' } }, { id: 'a' }],
    });
    assert.equal(run('--check').status, 0);
    writeFileSync(join(repo, 'tooling/config/ui-adoption.json'), '{}');
    assert.equal(run('--check').status, 1);
    source.projects[0].systems.ui.app.library = 'yes';
    writeFileSync(join(repo, 'catalog/projects.json'), JSON.stringify(source));
    assert.match(run().stderr, /Invalid design policy/);
    assert.equal(readFileSync(join(repo, 'tooling/config/ui-adoption.json'), 'utf8'), '{}');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
