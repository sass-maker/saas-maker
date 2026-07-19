import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createProjectResolver, validateMarketingProgram } from '../lib/marketing-program.mjs';

const registry = JSON.parse(await readFile(new URL('../config/marketing-program.json', import.meta.url), 'utf8'));

test('registry validates every active catalog project and exact focus set', async () => {
  const catalog = JSON.parse(await readFile(new URL('../../saas-maker/foundry.projects.json', import.meta.url), 'utf8'));
  const result = validateMarketingProgram(registry, { activeSlugs: [...Object.keys(catalog), 'fleet-ops', 'wifi-watch'] });
  assert.deepEqual(result.focusSet, ['pace', 'codevetter', 'posttrainllm']);
  assert.equal(result.projects.length, 22);
  assert.deepEqual(result.projects.filter((project) => project.contentBase).map((project) => project.slug).sort(), ['aliveville', 'high-signal', 'karte', 'rolepatch', 'saas-maker', 'significanthobbies', 'swe-interview-prep']);
});

test('canonical identities and historical aliases resolve uniquely', () => {
  const resolve = createProjectResolver(validateMarketingProgram(registry));
  assert.equal(resolve('linkchat'), 'karte');
  assert.equal(resolve('interview-coder'), 'swe-interview-prep');
  assert.equal(resolve('resume-tailor'), 'rolepatch');
  assert.equal(resolve('tinygpt'), 'posttrainllm');
  assert.equal(resolve('CodeVetter'), 'codevetter');
});

test('ambiguous aliases and focus drift fail validation', () => {
  const ambiguous = structuredClone(registry);
  ambiguous.projects.find((project) => project.slug === 'pace').aliases.push('linkchat');
  assert.throws(() => validateMarketingProgram(ambiguous), /belongs to both/);
  const focusDrift = structuredClone(registry);
  focusDrift.focusSet = ['pace'];
  assert.throws(() => validateMarketingProgram(focusDrift), /focusSet/);
});

test('channel programs require unique mappings and typed content bases', () => {
  const invalid = structuredClone(registry);
  invalid.projects.find((project) => project.slug === 'pace').channels = [{ channel: 'youtube_shorts', accountSlug: 'pace-youtube' }];
  assert.throws(() => validateMarketingProgram(invalid), /content base/);
});
