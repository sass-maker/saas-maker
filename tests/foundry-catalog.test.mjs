import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  buildCompatibilityViews,
  buildPerformanceProjection,
  buildPublicProjection,
  GENERATED_ROOT,
  readCatalog,
  serializeJson,
  validateCatalog,
  validatePublicProjection,
} from '../scripts/foundry-catalog-lib.mjs';

const catalog = await readCatalog();

function negativeFixture(mutator) {
  const fixture = structuredClone(catalog);
  mutator(fixture);
  return fixture;
}

function assertRejects(fixture, pattern) {
  const errors = validateCatalog(fixture);
  assert.ok(
    errors.some((error) => pattern.test(error)),
    `expected ${pattern}; got:\n${errors.join('\n')}`
  );
}

test('canonical catalog validates and bootstraps every current record class', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.products.length, 37);
  assert.equal(catalog.components.length, 36);
  assert.equal(catalog.packages.length, 27);
  assert.equal(catalog.skills.length, 23);
  assert.equal(catalog.automations.length, 9);
  assert.equal(catalog.publicRecords.length, 30);
  assert.equal(catalog.performanceSurfaces.length, 30);
  assert.deepEqual(
    catalog.pillars.map((pillar) => pillar.id),
    ['build', 'market', 'learn', 'visibility', 'control']
  );
  assert.ok(
    catalog.products
      .filter((product) => product.lifecycle === 'maintained')
      .every((product) => product.pillarIds.length === 1)
  );
  assert.deepEqual(catalog.sourcePolicy.evidenceStates, [
    'configured',
    'verified',
    'stale',
    'unknown',
    'not-applicable',
  ]);
});

test('performance projection covers maintained products without a duplicate registry', () => {
  const projection = buildPerformanceProjection(catalog);
  const maintained = catalog.products.filter((product) => product.lifecycle === 'maintained');
  assert.equal(projection.projects.length, maintained.length);
  assert.equal(projection.policy.synthetic.schedulesActive, false);
  assert.equal(projection.policy.mode, 'observation');
  assert.ok(
    projection.projects.some(
      (project) => project.projectId === 'sass-maker' && project.surfaces.length >= 4
    )
  );
  assert.equal(
    projection.projects.find((project) => project.projectId === 'mobile-dev-cockpit')
      ?.runtimeStatus,
    'not-applicable'
  );
});

test('performance rollout inventory tracks every maintained runtime without a second registry', () => {
  const views = buildCompatibilityViews(catalog);
  const projection = buildPerformanceProjection(catalog);
  const inventory = views.get('performance-rollout-inventory.json');
  assert.equal(inventory.items.length, projection.projects.length);
  assert.equal(inventory.canary.adapter, 'internal/performance-runtime');
  assert.ok(
    inventory.items
      .filter((item) => item.runtimeRequired && item.projectId !== 'sass-maker')
      .every((item) => item.rolloutAction === 'instrument-runtime-adapter')
  );
});

test('checked-in compatibility views are deterministic and current', async () => {
  const first = buildCompatibilityViews(catalog);
  const second = buildCompatibilityViews(structuredClone(catalog));
  assert.deepEqual([...first.keys()], [...second.keys()]);

  for (const [filename, view] of first) {
    const expected = serializeJson(view);
    assert.equal(serializeJson(second.get(filename)), expected);
    assert.equal(await readFile(path.join(GENERATED_ROOT, filename), 'utf8'), expected);
  }
});

test('legacy consumers are generated mirrors rather than independent registries', async () => {
  assert.equal(
    await readFile('foundry.projects.json', 'utf8'),
    await readFile(path.join(GENERATED_ROOT, 'foundry.projects.json'), 'utf8')
  );
  assert.equal(
    await readFile('ops/config/projects.json', 'utf8'),
    await readFile(path.join(GENERATED_ROOT, 'ops-config-projects.json'), 'utf8')
  );
  assert.equal(
    await readFile('ops/config/automation-registry.json', 'utf8'),
    await readFile(path.join(GENERATED_ROOT, 'automation-registry.json'), 'utf8')
  );
});

test('public projection is allowlisted and omits internal catalog fields', () => {
  const projection = buildPublicProjection(catalog);
  assert.equal(projection.products.length, 25);
  assert.deepEqual(validatePublicProjection(projection), []);
  const serialized = JSON.stringify(projection);
  for (const privateField of [
    'legacyKey',
    'path',
    'repositoryId',
    'ownerId',
    'observability',
    'deployment',
  ]) {
    assert.equal(serialized.includes(`"${privateField}"`), false);
  }
  assert.ok(projection.products.every((product) => product.url?.startsWith('https://')));
  assert.ok(projection.products.every((product) => product.changelogUrl && product.roadmapUrl));
  assert.equal(
    projection.products.some((product) =>
      ['aliveville', 'everythingrated', 'materia', 'protein-index', 'truehire'].includes(product.id)
    ),
    false
  );
});

test('negative fixtures reject duplicate identifiers', () => {
  assertRejects(
    negativeFixture((fixture) => fixture.products.push(structuredClone(fixture.products[0]))),
    /products id duplicate/
  );
});

test('negative fixtures reject duplicate domains', () => {
  assertRejects(
    negativeFixture((fixture) => fixture.components[1].deployment.domains.push('CODEVETTER.COM')),
    /domain duplicate/
  );
});

test('negative fixtures reject duplicate package names', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.packages[1].name = fixture.packages[0].name.toUpperCase();
    }),
    /package name duplicate/
  );
});

test('negative fixtures reject duplicate skill ids', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.skills[1].id = fixture.skills[0].id.toUpperCase();
    }),
    /skills id duplicate|skill id duplicate/
  );
});

test('negative fixtures reject duplicate schedule owners', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.automations[1].schedule.ownerId = fixture.automations[0].schedule.ownerId;
    }),
    /schedule owner duplicate/
  );
});

test('negative fixtures reject secret-like fields', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.products[0].api_key = 'placeholder';
    }),
    /secret-like field/
  );
});

test('negative fixtures reject invalid pillar assignments', () => {
  assertRejects(
    negativeFixture((fixture) => fixture.products[0].pillarIds.push('not-a-pillar')),
    /invalid pillar assignment/
  );
});

test('negative fixtures reject maintained products without observability', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.products[0].observability.contracts = [];
      fixture.products[0].observability.evidenceSources = [];
      fixture.products[0].observability.ownerId = '';
    }),
    /requires observability contracts/
  );
});

test('negative fixtures reject unsafe performance methods and URLs', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.performanceSurfaces[0].method = 'POST';
      fixture.performanceSurfaces[0].url = 'http://localhost:8787/probe?token=value';
    }),
    /method must be GET or HEAD/
  );
  assertRejects(
    negativeFixture((fixture) => {
      fixture.performanceSurfaces[0].url = 'https://example.com/probe?token=value';
    }),
    /must not contain query or fragment/
  );
});

test('negative fixtures reject unknown performance projects and missing provenance', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.performanceSurfaces[0].projectId = 'unknown-project';
    }),
    /references unknown product/
  );
  assertRejects(
    negativeFixture((fixture) => {
      fixture.performanceSurfaces[0].expectedStatuses = [];
    }),
    /requires expected statuses/
  );
});

test('negative fixtures keep schedules inert and privacy closed', () => {
  assertRejects(
    negativeFixture((fixture) => {
      fixture.performancePolicy.synthetic.schedulesActive = true;
    }),
    /schedules must remain inert/
  );
  assertRejects(
    negativeFixture((fixture) => {
      fixture.performancePolicy.privacy.queryValues = true;
    }),
    /privacy policy must forbid/
  );
});

test('negative fixtures reject private fields in public output', () => {
  const projection = buildPublicProjection(catalog);
  projection.products[0].repositoryId = 'codevetter';
  assert.ok(validatePublicProjection(projection).some((error) => /private field/.test(error)));
});
