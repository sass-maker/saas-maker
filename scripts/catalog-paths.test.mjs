import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogPaths } from './catalog-paths.mjs';

function workspace() {
  const fleetRoot = mkdtempSync(join(tmpdir(), 'portfolio-ownership-'));
  const repoRoot = join(fleetRoot, 'saas-maker');
  const owner = join(fleetRoot, 'site-health/catalog/projects.json');
  mkdirSync(join(repoRoot, 'catalog'), { recursive: true });
  mkdirSync(join(fleetRoot, 'site-health/catalog'), { recursive: true });
  return { fleetRoot, repoRoot, owner };
}

test('private catalog and operational outputs resolve to Site Health', () => {
  const { fleetRoot, repoRoot, owner } = workspace();
  writeFileSync(owner, '{}');
  const paths = catalogPaths(repoRoot, { fleetRoot });
  assert.equal(paths.source, owner);
  assert.equal(paths.operations, join(fleetRoot, 'site-health/catalog/generated/operations.json'));
  assert.equal(
    paths.repositoryTable,
    join(fleetRoot, 'site-health/catalog/generated/repository-classifications.md')
  );
});

test('legacy alias continues to address one editable source', () => {
  const { fleetRoot, repoRoot, owner } = workspace();
  writeFileSync(owner, '{}');
  symlinkSync(owner, join(repoRoot, 'catalog/projects.json'));
  assert.equal(catalogPaths(repoRoot, { fleetRoot }).source, owner);
});

test('a second editable catalog fails closed instead of silently diverging', () => {
  const { fleetRoot, repoRoot, owner } = workspace();
  writeFileSync(owner, '{}');
  writeFileSync(join(repoRoot, 'catalog/projects.json'), '{}');
  assert.throws(() => catalogPaths(repoRoot, { fleetRoot }), /Two editable portfolio catalogs/);
});

test('standalone legacy tooling remains usable until its source is transferred', () => {
  const { fleetRoot, repoRoot } = workspace();
  const legacy = join(repoRoot, 'catalog/projects.json');
  writeFileSync(legacy, '{}');
  assert.equal(catalogPaths(repoRoot, { fleetRoot }).source, legacy);
});
