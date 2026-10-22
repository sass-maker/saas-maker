import assert from 'node:assert/strict';
import test from 'node:test';
import { collectRepository, workflowConfig } from './collect.mjs';

test('extracts quoted, inline and multiline triggers without reading job configuration', () => {
  assert.deepEqual(workflowConfig('name: CI\non: [push, pull_request]\njobs:\n  schedule: {}'), {
    triggers: ['push', 'pull_request'], schedules: [], configUnknown: false,
  });
  assert.deepEqual(workflowConfig('"on":\n  schedule:\n    - cron: "0 4 * * *"\n  workflow_dispatch:\njobs: {}'), {
    triggers: ['schedule', 'workflow_dispatch'], schedules: ['0 4 * * *'], configUnknown: false,
  });
  assert.equal(workflowConfig('jobs: {}').configUnknown, true);
});

test('collects current remote files, generated failures, all pages and current PR heads', async () => {
  const calls = [];
  const run = (id, event = 'push', conclusion = 'failure') => ({
    id, event, conclusion, status: 'completed', head_sha: 'head', head_branch: 'main',
  });
  const workflows = [
    { id: 1, path: '.github/workflows/daily.yml', state: 'active' },
    { id: 2, path: '.github/workflows/deleted.yml', state: 'active' },
    { id: 3, path: 'dynamic/pages', state: 'active' },
  ];
  const fake = async (endpoint, paginated) => {
    calls.push([endpoint, paginated]);
    if (endpoint === 'repos/acme/app') return { full_name: 'acme/app', default_branch: 'main' };
    if (endpoint.includes('/commits/')) return { sha: 'head' };
    if (endpoint.includes('/git/trees/')) return { tree: [
      { path: '.github/workflows/daily.yml', type: 'blob' },
      { path: '.github/workflows/unregistered.yml', type: 'blob' },
    ] };
    if (endpoint.endsWith('/actions/workflows?per_page=100')) return [
      { workflows: workflows.slice(0, 2) }, { workflows: workflows.slice(2) },
    ];
    if (endpoint.includes('/contents/')) return {
      encoding: 'base64', content: Buffer.from('on:\n  schedule:\n    - cron: "0 4 * * *"\n  push:\njobs: {}').toString('base64'),
    };
    if (endpoint.includes('/pulls?')) return [[{ number: 7, head: { sha: 'pr-head' } }]];
    if (endpoint.includes('/actions/runs?status=')) return [{ workflow_runs:
      endpoint.includes('status=queued') ? [{ ...run(99), status: 'queued', conclusion: null }] : [],
    }];
    if (endpoint.includes('/jobs?')) return [{ jobs: [] }, { jobs: [{
      id: 77, name: 'checks', conclusion: 'failure', steps: [{ name: 'Typecheck', conclusion: 'failure' }],
    }] }];
    if (endpoint.includes('/actions/runs?event=pull_request')) {
      assert.match(endpoint, /head_sha=pr-head/);
      return [{ workflow_runs: [{ ...run(4, 'pull_request'), workflow_id: 1 }] }];
    }
    if (endpoint.includes('event=schedule')) return { workflow_runs: [run(2, 'schedule')] };
    if (endpoint.includes('event=push')) return { workflow_runs: [run(1)] };
    if (endpoint.includes('/workflows/1/runs')) return { workflow_runs: [run(3, 'workflow_dispatch', 'success')] };
    if (endpoint.includes('/workflows/3/runs')) return { workflow_runs: [run(5, 'dynamic')] };
    throw new Error(`Unexpected test endpoint ${endpoint}`);
  };
  const result = await collectRepository('acme/app', fake);
  assert.deepEqual(result.errors, []);
  assert.equal(result.workflows.length, 2);
  assert.deepEqual(result.removed, ['.github/workflows/deleted.yml']);
  assert.deepEqual(result.unregistered, ['.github/workflows/unregistered.yml']);
  assert.equal(result.workflows[0].latest.conclusion, 'success');
  assert.equal(result.workflows[0].schedule.conclusion, 'failure');
  assert.equal(result.workflows[1].generated, true);
  assert.ok(result.failedJobs.some((entry) => entry.runId === 5));
  assert.deepEqual(result.failedJobs[0].jobs[0].steps, ['Typecheck']);
  assert.equal(result.pullRequests[0].head, 'pr-head');
  assert.equal(result.ongoing[0].id, 99);
  assert.equal(result.ongoing[0].status, 'queued');
  for (const [endpoint, paginated] of calls) {
    if (/\/jobs\?|\/pulls\?|\/actions\/workflows\?/.test(endpoint)) assert.equal(paginated, true);
  }
  assert.ok(!calls.some(([endpoint]) => endpoint.includes('/workflows/2/')));
});

test('retains unknown inventory and truncated-tree evidence instead of reporting health', async () => {
  const denied = await collectRepository('acme/private', async () => { throw new Error('HTTP 403'); });
  assert.deepEqual(denied.errors, ['HTTP 403']);
  const result = await collectRepository('acme/app', async (endpoint) => {
    if (endpoint === 'repos/acme/app') return { default_branch: 'main' };
    if (endpoint.includes('/commits/')) return { sha: 'head' };
    if (endpoint.includes('/git/trees/')) return { tree: [], truncated: true };
    return [];
  });
  assert.match(result.errors[0], /inventory incomplete/);
});
