import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const deploy = fileURLToPath(new URL('deploy.mjs', import.meta.url));
const sha = 'a'.repeat(40);
const stub = `#!${process.execPath}
const { appendFileSync } = require('node:fs');
const { basename } = require('node:path');
const tool = basename(process.argv[1]);
const args = process.argv.slice(2);
const scenario = process.env.MCP_DEPLOY_SCENARIO;
appendFileSync(process.env.MCP_DEPLOY_CAPTURE, JSON.stringify({tool,args,cwd:process.cwd()}) + '\\n');
if (tool === 'git') {
  const key = args.join(' ');
  if (key === 'branch --show-current') process.stdout.write(scenario === 'branch' ? 'feature' : 'main');
  else if (key === 'status --porcelain') process.stdout.write(scenario === 'dirty' ? ' M unrelated-root-file' : '');
  else if (key === 'rev-parse --abbrev-ref --symbolic-full-name @{u}') process.stdout.write('origin/main');
  else if (key === 'rev-list --left-right --count origin/main...HEAD') process.stdout.write(scenario === 'unsynced' ? '1 0' : '0 0');
  else if (key === 'rev-parse HEAD') process.stdout.write('${sha}');
  else if (key === 'remote get-url origin') process.stdout.write('https://github.com/sass-maker/saas-maker.git');
  else if (key !== 'fetch --quiet origin') process.exit(90);
} else if (tool === 'gh') {
  if (args[0] === 'auth') process.exit(scenario === 'unauthenticated' ? 1 : 0);
  if (args[0] !== 'run' || args[1] !== 'list') process.exit(91);
  if (args[args.indexOf('--workflow') + 1] !== 'mcp-ci.yml') process.exit(92);
  if (args[args.indexOf('-R') + 1] !== 'sass-maker/saas-maker') process.exit(93);
  const headSha = scenario === 'stale-ci' ? 'b'.repeat(40) : '${sha}';
  const conclusion = scenario === 'failed-ci' ? 'failure' : 'success';
  process.stdout.write(JSON.stringify([{status:'completed',conclusion,headSha,url:'https://example.invalid/run'}]));
} else if (tool === 'pnpm') {
  process.exit(scenario === 'upload-failed' ? 1 : 0);
} else process.exit(94);
`;

async function attempt(t, scenario) {
  const scratch = await mkdtemp(join(tmpdir(), 'mcp-deploy-test-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const capture = join(scratch, 'calls.jsonl');
  for (const name of ['git', 'gh', 'pnpm']) {
    await writeFile(join(scratch, name), stub, { mode: 0o755 });
  }
  const result = spawnSync(process.execPath, [deploy], {
    cwd: tmpdir(),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${scratch}${delimiter}${process.env.PATH}`,
      MCP_DEPLOY_SCENARIO: scenario,
      MCP_DEPLOY_CAPTURE: capture,
    },
  });
  assert.ifError(result.error);
  const calls = (await readFile(capture, 'utf8')).trim().split('\n').map(JSON.parse);
  return { ...result, calls };
}

test('deploy uses SaaS Maker exact-head MCP CI and uploads from the locked child', async (t) => {
  const result = await attempt(t, 'success');
  assert.equal(result.status, 0, result.stderr);
  const upload = result.calls.find((call) => call.tool === 'pnpm');
  assert.deepEqual(upload?.args, ['exec', 'wrangler', 'deploy', '--tag', sha]);
  assert.equal(upload?.cwd, root.replace(/\/$/u, ''));
});

for (const [scenario, reason] of [
  ['branch', /expected main/u],
  ['dirty', /working tree is dirty/u],
  ['unsynced', /not synced with origin\/main/u],
  ['unauthenticated', /gh is not authenticated/u],
  ['stale-ci', /no successful mcp-ci.yml run/u],
  ['failed-ci', /no successful mcp-ci.yml run/u],
]) {
  test(`deploy blocks ${scenario} before any Worker upload`, async (t) => {
    const result = await attempt(t, scenario);
    assert.equal(result.status, 1);
    assert.match(result.stderr, reason);
    assert.equal(result.calls.some((call) => call.tool === 'pnpm'), false);
  });
}

test('deploy reports a failed Worker upload', async (t) => {
  const result = await attempt(t, 'upload-failed');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /wrangler deploy exited with status 1/u);
});
