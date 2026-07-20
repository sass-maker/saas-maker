import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  LEGACY_DISTRIBUTION_ERROR_CODE,
  legacyDistributionFailure,
} from '../services/reel-pipeline/src/legacy-distribution-guard.js';

test('legacy distribution commands fail closed with a stable machine-readable code', () => {
  assert.deepEqual(legacyDistributionFailure('youtube-oauth'), {
    ok: false,
    code: LEGACY_DISTRIBUTION_ERROR_CODE,
    action: 'youtube-oauth',
    message: 'youtube-oauth is disabled in Reel Pipeline; use the Foundry Postiz adapter',
  });

  const result = spawnSync(
    process.execPath,
    ['services/reel-pipeline/scripts/legacy-distribution-disabled.js', 'direct-posting'],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 78);
  assert.equal(JSON.parse(result.stderr).code, LEGACY_DISTRIBUTION_ERROR_CODE);
});

test('mutating Reel package commands all route through the disabled shim', async () => {
  const packageJson = JSON.parse(await readFile('services/reel-pipeline/package.json', 'utf8'));
  for (const command of [
    'marketing',
    'post:ready',
    'sync:metrics',
    'autopilot',
    'autopilot:once',
    'yt:bootstrap',
    'ig:bootstrap',
    'ig:refresh',
  ]) {
    assert.match(packageJson.scripts[command], /legacy-distribution-disabled\.js/);
  }
});
