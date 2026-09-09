import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
    for (const [directory, scripts] of Object.entries(options.packages || {})) {
      mkdirSync(join(project, directory), { recursive: true });
      writeFileSync(join(project, directory, 'package.json'), JSON.stringify({ scripts }));
    }
    if (options.externalPackage) {
      const external = join(root, 'outside');
      mkdirSync(external);
      writeFileSync(join(external, 'package.json'), JSON.stringify({ scripts: { build: 'astro build' } }));
      symlinkSync(external, join(project, 'website'));
    }
    writeFileSync(join(project, ci.path), options.ciSource ?? ciSource);
    writeFileSync(join(project, docs.path), docsSource);
    if (options.ignoredPackage) writeFileSync(join(project, '.gitignore'), 'website/package.json\n');
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

test('unconditional success-dependent quality chains qualify without accepting background commands', () => {
  const result = exercise({ scripts: {
    quality: 'pnpm check && pnpm typecheck && pnpm test:coverage && pnpm docs:check',
    check: 'biome check .', typecheck: 'tsc --noEmit',
    'test:coverage': 'vitest run --coverage', 'docs:check': 'node scripts/check-docs.mjs',
  } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const quality of ['vitest run &&& true', 'vitest run & true', 'vitest run && true &']) {
    rejected({ scripts: { quality } }, /no successful source-backed/);
  }
});


test('independent unconditional validation survives unrelated conditional jobs and steps', () => {
  const source = `name: CI
on: [push]
jobs:
  optional:
    if: false
    uses: ./.github/workflows/native.yml
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Optional fetch
        if: false
        run: git fetch origin main
      - name: Rust contracts
        run: cargo test --manifest-path crates/core/Cargo.toml
`;
  const result = exercise({ ciSource: source });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('conditional validator cannot borrow eligibility from an unconditional non-test step', () => {
  const source = ciSource.replace('- run: pnpm quality', '- run: echo setup\n      - run: pnpm quality\n        if: false');
  rejected({ ciSource: source }, /no successful source-backed/);
});

test('dependency-gated jobs and YAML inheritance stay unknown', () => {
  for (const directive of ['needs: optional', 'strategy: {}', '<<: *defaults']) {
    rejected({ ciSource: ciSource.replace('    steps:', `    ${directive}\n    steps:`) }, /no successful source-backed/);
  }
});


test('alternate control-key whitespace and duplicate run keys fail closed', () => {
  for (const directive of ['if : false', 'continue-on-error : true']) {
    rejected({ ciSource: ciSource.replace('    steps:', `    ${directive}\n    steps:`) }, /no successful source-backed/);
    rejected({ ciSource: ciSource.replace('- run: pnpm quality', `- run: pnpm quality\n        ${directive}`) }, /no successful source-backed/);
  }
  rejected({ ciSource: ciSource.replace('- run: pnpm quality', '- run: pnpm quality\n        run: echo no-test') }, /no successful source-backed/);
});

test('shell early exit and multiline conditionals cannot advertise unreachable tests', () => {
  for (const quality of ['exit 0\nvitest run', 'echo setup && exit 0 && vitest run', 'if false\nthen\nvitest run\nfi', 'check() {\nvitest run\n}', 'command exit 0\nvitest run']) {
    rejected({ scripts: { quality } }, /no successful source-backed/);
  }
});


test('quoted control keys, custom shells and duplicate job ids remain unknown', () => {
  for (const directive of ['"if": false', 'shell: bash {0}']) {
    rejected({ ciSource: ciSource.replace('- run: pnpm quality', `- run: pnpm quality\n        ${directive}`) }, /no successful source-backed/);
  }
  rejected({ ciSource: ciSource + '  validate:\n    if: false\n    steps:\n      - run: pnpm quality\n' }, /no successful source-backed/);
});


const pythonDirectoryJob = `  python:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: python/ingest
    steps:
      - run: uv run pytest -q --cov=example --cov-fail-under=55
`;

test('unrelated job directory does not disable root package script evidence', () => {
  const source = ciSource + pythonDirectoryJob.replace('uv run pytest -q --cov=example --cov-fail-under=55', 'echo setup');
  const result = exercise({ ciSource: source });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('literal job directory admits direct pytest without interpreting package wrappers', () => {
  const source = 'name: CI\non: [push]\njobs:\n' + pythonDirectoryJob;
  const result = exercise({ ciSource: source });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const command of ['pnpm quality', 'node scripts/run-tests.mjs', 'cargo test', 'echo pytest']) {
    rejected({ ciSource: source.replace('uv run pytest -q --cov=example --cov-fail-under=55', command) }, /no successful source-backed/);
  }
});

test('unknown directories and default mappings cannot establish test evidence', () => {
  const source = 'name: CI\non: [push]\njobs:\n' + pythonDirectoryJob;
  for (const value of ['${{ matrix.path }}', '|', '{ path: python }', 'python/ingest\n        unknown: value', 'python/ingest\n        working-directory: other']) {
    rejected({ ciSource: source.replace('python/ingest', value) }, /no successful source-backed/);
  }
  for (const directive of ['if: false', 'continue-on-error: true', 'needs: setup']) {
    rejected({ ciSource: source.replace('    defaults:', `    ${directive}\n    defaults:`) }, /no successful source-backed/);
  }
  rejected({ ciSource: source.replace('        working-directory: python/ingest', '        shell: bash {0}') }, /no successful source-backed/);
});

test('step directory cannot borrow root package scripts or accept a dynamic path', () => {
  rejected({ ciSource: ciSource.replace('- run: pnpm quality', '- run: pnpm quality\n        working-directory: python/ingest') }, /no successful source-backed/);
  rejected({ ciSource: ciSource.replace('- run: pnpm quality', '- run: uv run pytest -q\n        working-directory: ${{ matrix.path }}') }, /no successful source-backed/);
});


test('an unrelated step directory does not disable a root package validator', () => {
  const source = ciSource.replace('      - run: pnpm quality', '      - run: echo setup\n        working-directory: python/ingest\n      - run: pnpm quality');
  const result = exercise({ ciSource: source });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('workflow defaults remain unknown rather than assuming root scripts', () => {
  const source = ciSource.replace('jobs:', 'defaults:\n  run:\n    working-directory: python/ingest\njobs:');
  rejected({ ciSource: source }, /no successful source-backed/);
});


const websiteDirectorySource = 'name: CI\non: [push]\njobs:\n' + pythonDirectoryJob
  .replace('python/ingest', 'website')
  .replace('uv run pytest -q --cov=example --cov-fail-under=55', 'pnpm run build');

test('literal job package scripts resolve against that package, including required build chains', () => {
  const result = exercise({ ciSource: websiteDirectorySource,
    scripts: { build: 'echo root is not evidence' },
    packages: { website: { build: 'pnpm run docs && astro build', docs: 'node merge-docs.mjs' } } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('literal step directory overrides job directory without borrowing another manifest', () => {
  const source = websiteDirectorySource.replace('      - run: pnpm run build', '      - run: pnpm run build\n        working-directory: packages/site');
  const result = exercise({ ciSource: source, packages: {
    website: { build: 'echo no validation' }, 'packages/site': { build: 'vite build' },
  } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  rejected({ ciSource: source, packages: { website: { build: 'astro build' } } }, /no successful source-backed/);
});

test('scoped manifests cannot prove commands from root, another directory or an unsafe wrapper', () => {
  for (const build of ['echo astro build', 'astro build || true', 'pnpm run build', 'cd ../other && astro build']) {
    rejected({ ciSource: websiteDirectorySource, scripts: { build: 'astro build' },
      packages: { website: { build } } }, /no successful source-backed/);
  }
  rejected({ ciSource: websiteDirectorySource, scripts: { build: 'astro build' } }, /no successful source-backed/);
});

test('absolute, parent and external symlink package paths stay unknown', () => {
  for (const directory of ['/tmp/website', '../outside', 'website/../website']) {
    rejected({ ciSource: websiteDirectorySource.replace('working-directory: website', `working-directory: ${directory}`),
      packages: { website: { build: 'astro build' } } }, /no successful source-backed/);
  }
  rejected({ ciSource: websiteDirectorySource, externalPackage: true }, /no successful source-backed/);
});


test('ignored package manifests cannot supply exact-source build evidence', () => {
  rejected({ ciSource: websiteDirectorySource, ignoredPackage: true,
    packages: { website: { build: 'astro build' } } }, /no successful source-backed/);
});
