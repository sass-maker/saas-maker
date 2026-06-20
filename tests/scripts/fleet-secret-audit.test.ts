import { describe, expect, it } from 'vitest';

import {
  buildProjectSecretPlan,
  compareSecrets,
  detectCloudflareTarget,
  extractRepoFromGitUrl,
  extractWorkflowSecretRequirements,
  parseCloudflareConfigState,
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

  it('parses Wrangler vars and bindings without reading values', () => {
    expect(parseCloudflareConfigState(`
name = "example"
[vars]
NODE_ENV = "production"
PUBLIC_URL = "https://example.com"
[[d1_databases]]
binding = "DB"
`)).toEqual({
      vars: ['NODE_ENV', 'PUBLIC_URL'],
      bindings: ['DB'],
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

  it('builds a manifest-backed plan with multiple Cloudflare targets', () => {
    const plan = buildProjectSecretPlan(
      { slug: 'demo', repo: 'owner/demo', dir: '/missing' },
      {
        deployTarget: 'Cloudflare Workers',
        githubWorkflow: null,
        requiredEnv: { build: [], runtime: ['OLD_SECRET'] },
      },
      {
        demo: {
          targets: [
            {
              kind: 'worker',
              name: 'demo-api',
              dir: 'workers/api',
              requiredSecrets: ['API_SECRET'],
              requiredVars: ['NODE_ENV'],
            },
            {
              kind: 'pages',
              name: 'demo-web',
              requiredSecrets: ['WEB_SECRET'],
            },
          ],
        },
      },
    );

    expect(plan.runtimes).toHaveLength(2);
    expect(plan.runtimes[0]).toMatchObject({
      provider: 'cloudflare-worker',
      name: 'demo-api',
      requiredSecrets: ['API_SECRET'],
      requiredVars: ['NODE_ENV'],
    });
    expect(plan.runtimes[1]).toMatchObject({
      provider: 'cloudflare-pages',
      name: 'demo-web',
      requiredSecrets: ['WEB_SECRET'],
    });
    expect(plan.runtime.required).toEqual(['API_SECRET']);
  });

  it('allows manual Cloudflare deploy targets to audit runtime secrets only', () => {
    const plan = buildProjectSecretPlan(
      { slug: 'rag-service', repo: null, dir: '/missing' },
      {
        deployTarget: 'Cloudflare Workers + D1 + Vectorize + R2',
        deploySecretsRequired: false,
        githubWorkflow: null,
        requiredEnv: { build: [], runtime: ['RAG_SERVICE_KEYS'] },
      },
      {
        'rag-service': {
          targets: [
            {
              kind: 'worker',
              name: 'rag-service',
              requiredSecrets: ['RAG_SERVICE_KEYS'],
            },
          ],
        },
      },
    );

    expect(plan.github.required).toEqual([]);
    expect(plan.runtime).toMatchObject({
      provider: 'cloudflare-worker',
      name: 'rag-service',
      required: ['RAG_SERVICE_KEYS'],
    });
  });
});
