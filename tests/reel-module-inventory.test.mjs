import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const serviceRoot = path.resolve('services/reel-pipeline');
const inventory = JSON.parse(
  await readFile(path.join(serviceRoot, 'config/module-boundary-inventory.json'), 'utf8')
);

async function listModules(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const modules = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      modules.push(...(await listModules(path.join(directory, entry.name), relative)));
    } else if (/\.(?:js|mjs)$/.test(entry.name)) {
      modules.push(relative);
    }
  }
  return modules;
}

test('every Reel Pipeline JavaScript module has exactly one migration category', async () => {
  const discovered = (
    await Promise.all(
      inventory.roots.map(async (root) =>
        (await listModules(path.join(serviceRoot, root), root)).sort()
      )
    )
  ).flat();
  const declared = Object.values(inventory.categories).flat();

  assert.equal(new Set(declared).size, declared.length, 'inventory contains duplicate paths');
  assert.deepEqual(declared.toSorted(), discovered.toSorted());
});

test('provider execution stays outside the generation category', () => {
  const generation = new Set(inventory.categories.generation);
  for (const directPublisher of [
    'src/publishers/instagram.js',
    'src/publishers/youtube.js',
    'src/posting.js',
    'src/distribution.js',
    'scripts/instagram-oauth-bootstrap.js',
    'scripts/youtube-oauth-bootstrap.js',
  ]) {
    assert.equal(generation.has(directPublisher), false, directPublisher);
  }
});
