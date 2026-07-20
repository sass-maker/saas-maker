import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildBrandScenes } from '../src/adapters/brand-video.js';

const contentPackage = JSON.parse(await readFile(new URL('./fixtures/approved-content-package.json', import.meta.url), 'utf8'));

test('brand video uses five source-backed teaching scenes', () => {
  const scenes = buildBrandScenes(contentPackage, contentPackage.variants[0]);
  assert.deepEqual(scenes.map((scene) => scene.kind), ['Hook', 'Context', 'Evidence', 'Takeaway', 'Next']);
  assert.match(scenes[2].caption, /highsignal\.app/);
  assert.equal(scenes[3].title, 'The practical next move: Read the evidence.');
});
