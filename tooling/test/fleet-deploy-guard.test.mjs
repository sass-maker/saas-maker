import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const guard = resolve(import.meta.dirname, '../scripts/fleet-deploy-guard.sh');
const ci = { id: 1, path: '.github/workflows/verify.yml', state: 'active', name: 'Build and test' };
const docs = { id: 2, path: '.github/workflows/docs.yml', state: 'active', name: 'Docs' };
const ciSource = 'name: Arbitrary display title\non: [push]\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm quality\n';
const docsSource = 'name: CI\non: [push]\njobs:\n  docs:\n    runs-on: ubuntu-latest\n    steps:\n      - run: node scripts/check-docs.mjs\n';

export function exercise(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fleet-guard-test-'));
  const project = join(root, 'sample');
  const bin = join(root, 'bin');
  mkdirSync(join(project, '.github/workflows'), { recursive: true });
  mkdirSync(bin);
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: project, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    writeFileSync(join(project, 'wrangler.json'), '{"name":"synthetic-target"}');
    writeFileSync(join(project, 'package.json'), JSON.stringify({ scripts: options.scripts || { quality: 'pnpm test', test: 'vitest run' } }));
    writeFileSync(join(project, ci.path), options.ciSource ?? ciSource);
    writeFileSync(join(project, docs.path), docsSource);
    git('init', '-b', 'main');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'synthetic fixture');
    git('remote', 'add', 'origin', 'https://github.com/example/sample.git');
    const sha = git('rev-parse', 'HEAD');
    git('update-ref', 'refs/remotes/origin/main', sha);
    git('branch', '--set-upstream-to=origin/main', 'main');
    const run = (workflow, overrides = {}) => ({ id: workflow.id * 10, workflow_id: workflow.id, run_attempt: 1, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', ...overrides });
    const runs = options.runs ? options.runs(run) : [run(docs), run(ci)];
    const definitions = options.definitions ?? [ci, docs];
    const fixture = {
      runs: options.pages ? options.pages(run) : [{ total_count: runs.length, workflow_runs: runs }],
      workflows: [{ total_count: definitions.length, workflows: definitions }],
      apiError: options.apiError,
    };
    const fixturePath = join(root, 'fixture.json');
    writeFileSync(fixturePath, JSON.stringify(fixture));
    writeFileSync(join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') process.exit(0);
const fixture = JSON.parse(fs.readFileSync(process.env.GUARD_FIXTURE, 'utf8'));
if (args[0] !== 'api' || fixture.apiError) process.exit(1);
if (!args.includes('--paginate') || !args.includes('--slurp')) process.exit(2);
const url = args.find(arg => arg.startsWith('repos/')) || '';
if (url.includes('/actions/runs?')) console.log(JSON.stringify(fixture.runs));
else if (url.includes('/actions/workflows?')) console.log(JSON.stringify(fixture.workflows));
else process.exit(3);
`);
    chmodSync(join(bin, 'gh'), 0o755);
    return spawnSync('bash', [guard, 'sample', ...(options.force ? ['--force'] : [])], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FLEET_ROOT_OVERRIDE: root, GUARD_FIXTURE: fixturePath },
      timeout: 10000,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function rejected(options, message) {
  const result = exercise(options);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /NOT READY/);
  assert.match(result.stdout, message);
}

test('Docs green cannot mask genuinely pending build/test CI', () => {
  rejected({ runs: run => [run(docs), run(ci, { status: 'in_progress', conclusion: null })] }, /verify.yml: in_progress\/none/);
});

test('Docs green cannot mask failed build/test CI', () => {
  rejected({ runs: run => [run(docs), run(ci, { conclusion: 'failure' })] }, /verify.yml: completed\/failure/);
});

test('all exact-head push workflows green with source-backed package test passes', () => {
  const result = exercise();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /2 push workflows, 1 build\/test definitions/);
});

test('a workflow named CI that only validates docs does not prove build/test CI', () => {
  rejected({ runs: run => [run(docs)] }, /no successful source-backed build\/test/);
});

test('workflow display names do not determine validation identity', () => {
  const result = exercise({ definitions: [{ ...ci, name: 'Docs' }, docs] });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('the newest attempt replaces a prior failed attempt of the same workflow', () => {
  const result = exercise({ runs: run => [run(ci, { run_attempt: 2 }), run(docs), run(ci, { conclusion: 'failure' })] });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('a new pending run cannot inherit an older green run of its workflow', () => {
  rejected({ runs: run => [run(ci, { id: 11, status: 'queued', conclusion: null }), run(docs), run(ci)] }, /queued\/none/);
});

test('a red auxiliary push workflow still blocks a green build', () => {
  rejected({ runs: run => [run(docs, { conclusion: 'failure' }), run(ci)] }, /docs.yml: completed\/failure/);
});

test('no runs, skipped workflows, missing metadata and disabled workflows fail closed', () => {
  rejected({ runs: () => [] }, /no push CI/);
  rejected({ runs: run => [run(ci, { conclusion: 'skipped' })] }, /completed\/skipped/);
  rejected({ definitions: [docs] }, /missing or disabled/);
  rejected({ definitions: [{ ...ci, state: 'disabled_manually' }, docs] }, /missing or disabled/);
});

test('query failures and mismatched revision or event cannot establish readiness', () => {
  rejected({ apiError: true }, /GitHub Actions query failed/);
  rejected({ runs: run => [run(ci, { head_sha: 'other' })] }, /non-exact push evidence/);
  rejected({ runs: run => [run(ci, { event: 'workflow_dispatch' })] }, /non-exact push evidence/);
});

test('comments, echo text and opaque scripts never count as validation', () => {
  rejected({ ciSource: ciSource.replace('pnpm quality', 'echo pnpm test') }, /no successful source-backed/);
  rejected({ ciSource: ciSource.replace('- run: pnpm quality', '# - run: pnpm quality') }, /no successful source-backed/);
  rejected({ scripts: { quality: 'echo "ok && vitest run"' } }, /no successful source-backed/);
});

test('literal multiline validator is recognized without executing it', () => {
  const result = exercise({ ciSource: ciSource.replace('run: pnpm quality', 'run: |\n          uv run pytest -q\n          echo done') });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('existing force flag still skips CI rather than adding a new bypass', () => {
  const result = exercise({ apiError: true, force: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /skipped \(--force\)/);
});


test('multiline Docs step cannot swallow later non-run scalar text', () => {
  rejected({ ciSource: 'name: Docs\non: [push]\njobs:\n  docs:\n    steps:\n      - run: |\n          node scripts/check-docs.mjs\n          echo done\n      - name: Description\n        env:\n          NOTE: |\n            vitest run\n        uses: actions/checkout@v6\n' }, /no successful source-backed/);
});

test('actual checked-in SaaS Maker CI and package scripts establish validation identity', () => {
  const repository = resolve(import.meta.dirname, '../..');
  const result = exercise({
    ciSource: readFileSync(join(repository, '.github/workflows/ci.yml'), 'utf8'),
    scripts: JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8')).scripts,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});


test('a pending workflow on another API page still blocks Docs success', () => {
  rejected({ pages: run => [
    { total_count: 2, workflow_runs: [run(docs)] },
    { total_count: 2, workflow_runs: [run(ci, { status: 'queued', conclusion: null })] },
  ] }, /queued\/none/);
});

test('incomplete pagination cannot silently omit a workflow', () => {
  rejected({ pages: run => [{ total_count: 2, workflow_runs: [run(docs)] }] }, /incomplete GitHub Actions response/);
});


test('conditional and error-tolerant workflows cannot establish validation', () => {
  for (const directive of ['if: false', 'if: ${{ always() }}', 'continue-on-error: true']) {
    rejected({ ciSource: ciSource.replace('    steps:', `    ${directive}\n    steps:`) }, /no successful source-backed/);
    rejected({ ciSource: ciSource.replace('- run: pnpm quality', `- run: pnpm quality\n        ${directive}`) }, /no successful source-backed/);
  }
});

test('shell control and failure masking cannot establish validation', () => {
  for (const quality of ['vitest run || true', 'vitest run; true', 'vitest run | cat', 'vitest run > result', 'vitest run &', 'vitest run <<EOF', 'vitest run $(echo --passWithNoTests)']) {
    rejected({ scripts: { quality } }, /no successful source-backed/);
  }
});


test('informational CLI flags do not establish build/test validation', () => {
  for (const quality of ['vitest --help', 'jest --version', 'pytest -h', 'vite build --help']) {
    rejected({ scripts: { quality } }, /no successful source-backed/);
  }
});
