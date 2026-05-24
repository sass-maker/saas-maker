import { describe, expect, it } from 'vitest';

import {
  buildProjectSecretPlan,
  compareSecrets,
  detectCloudflareTarget,
  extractRepoFromGitUrl,
  extractWorkflowSecretRequirements,
  parseSecretNames,
  parseWranglerName,
} from '../../scripts/lib/fleet-secret-audit.mjs';

describe('fleet secret audit helpers', () => {
  it('parses GitHub repository URLs', () => {
    expect(extractRepoFromGitUrl('https://github.com/owner/repo.git')).toBe('owner/repo');
    expect(extractRepoFromGitUrl('git@github.com:owner/repo.git')).toBe('owner/repo');
    expect(extractRepoFromGitUrl('not-a-url')).toBeNull();
  });

  it('parses secret names from json and wrangler text output', () => {
    expect(parseSecretNames('[{"name":"AAA"},{"name":"BBB"}]')).toEqual(['AAA', 'BBB']);
    expect(parseSecretNames('The production environment has access to:\nAAA\nBBB\n')).toEqual(['AAA', 'BBB']);
    expect(parseSecretNames('The production environment has access to:\n  - AAA: Value Encrypted\n')).toEqual(['AAA']);
  });

  it('compares required and present secret names without values', () => {
    expect(compareSecrets(['A', 'B'], ['B'])).toMatchObject({
      ok: false,
      missing: ['A'],
    });
    expect(compareSecrets([['A', 'B']], ['B'])).toMatchObject({
      ok: true,
      missing: [],
    });
  });

  it('detects Cloudflare config names and target kind', () => {
    expect(parseWranglerName('name = "reader"')).toBe('reader');
    expect(parseWranglerName('{ "name": "starboard" }')).toBe('starboard');
    expect(detectCloudflareTarget('/missing', { deployTarget: 'Cloudflare Pages' })).toMatchObject({
      kind: 'cloudflare-pages',
    });
  });

  it('extracts workflow secret references with alternatives', () => {
    expect(extractWorkflowSecretRequirements('/missing', 'deploy.yml')).toEqual([]);
  });

  it('builds a plan with workflow and runtime secrets split by platform', () => {
    const plan = buildProjectSecretPlan(
      { slug: 'reader', repo: 'owner/reader', dir: '/missing' },
      {
        deployTarget: 'Cloudflare Workers',
        githubWorkflow: 'deploy.yml',
        requiredEnv: {
          build: ['NEXT_PUBLIC_KEY'],
          runtime: ['GOOGLE_CLIENT_SECRET'],
        },
      },
    );
    expect(plan.github.required).toEqual(['NEXT_PUBLIC_KEY']);
    expect(plan.runtime).toMatchObject({
      provider: 'cloudflare-worker',
      required: ['GOOGLE_CLIENT_SECRET'],
    });
  });
});
