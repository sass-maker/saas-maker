import assert from 'node:assert/strict';
import test from 'node:test';

import socialTemplate from '../config/social-accounts.example.json' with { type: 'json' };
import { checkSocialReadiness } from '../src/social-readiness.js';

test('social template declares every pre-routed account', () => {
  assert.equal(Object.keys(socialTemplate.youtube).length, 7);
  assert.equal(Object.keys(socialTemplate.instagram).length, 7);
  const report = checkSocialReadiness({ configPath: '/definitely/missing.json', templatePath: 'config/social-accounts.example.json', env: {}, ffmpegReady: true, fndBin: '/definitely/missing-fnd' });
  assert.equal(report.summary.totalAccounts, 14);
  assert.equal(report.summary.routedAccounts, 14);
  assert.equal(report.summary.connectedAccounts, 0);
  assert.equal(report.summary.readyForLivePosting, false);
  assert.equal(report.accounts.every((entry) => entry.accountDeclared && entry.routeConfigured), true);
});

test('readiness becomes true when all declared env and infrastructure inputs exist', () => {
  const env = {
    SAASMAKER_SESSION_TOKEN: 'present', REEL_ARTIFACT_R2_BUCKET: 'bucket', REEL_ARTIFACT_BASE_URL: 'https://assets.example.test', PATH: '',
  };
  for (const accounts of Object.values(socialTemplate)) {
    for (const account of Object.values(accounts)) {
      for (const [key, envName] of Object.entries(account)) if (key.endsWith('Env')) env[envName] = 'present';
    }
  }
  const report = checkSocialReadiness({ configPath: '/definitely/missing.json', templatePath: 'config/social-accounts.example.json', env, ffmpegReady: true, kokoroReady: true, fndBin: '/definitely/missing-fnd' });
  assert.equal(report.summary.connectedAccounts, 14);
  assert.equal(report.summary.readyForLivePosting, true);
});
