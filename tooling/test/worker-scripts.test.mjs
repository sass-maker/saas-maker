import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const flowScript = path.join(repoRoot, 'tooling/skills/flow-veo-browser/scripts/flow.py');
const julesScript = path.join(repoRoot, 'tooling/skills/jules-cloud-worker/scripts/jules.py');

function python(code, args = [], env = {}) {
  return spawnSync('python3', ['-c', code, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, ...env },
  });
}

function flow(temp, ...args) {
  return spawnSync('python3', [path.join(temp, 'scripts/flow.py'), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, FLOW_MEDIA_ROOT: path.join(temp, 'media') },
  });
}

test('worker skills use the Fleet catalog contract', () => {
  for (const skill of ['flow-veo-browser', 'jules-cloud-worker']) {
    const root = path.join(repoRoot, 'tooling/skills', skill);
    const frontmatter = readFileSync(path.join(root, 'SKILL.md'), 'utf8').split('---')[1];
    assert.doesNotMatch(frontmatter, /^version:/m);
    const profile = JSON.parse(readFileSync(path.join(root, 'execution-profile.json'), 'utf8'));
    assert.equal(profile.schema, 'fleet.skill-execution-profile.v1');
    assert.ok(profile.recommended?.intelligence);
    assert.ok(profile.minimum?.reasoning);
    assert.ok(['allow', 'ask', 'deny'].includes(profile.degradation));
  }
});

test('Flow rejects overdrafts, negative costs, and project traversal', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'flow-worker-test-'));
  mkdirSync(path.join(temp, 'scripts'), { recursive: true });
  mkdirSync(path.join(temp, 'state'), { recursive: true });
  copyFileSync(flowScript, path.join(temp, 'scripts/flow.py'));

  assert.equal(flow(temp, 'balance', 'set', 'A', '10').status, 0);
  const overdraft = flow(temp, 'debit', 'A', '20');
  assert.notEqual(overdraft.status, 0);
  assert.match(`${overdraft.stdout}${overdraft.stderr}`, /balance 10 < credits 20/);

  const negative = flow(temp, 'route', '--cost', '-5');
  assert.notEqual(negative.status, 0);
  assert.match(`${negative.stdout}${negative.stderr}`, /cost must be non-negative/);

  const traversal = flow(temp, 'init', '../escaped');
  assert.notEqual(traversal.status, 0);
  assert.match(`${traversal.stdout}${traversal.stderr}`, /must stay inside FLOW_MEDIA_ROOT/);
  assert.equal(existsSync(path.join(temp, 'escaped')), false);
});

test('Jules poll handles an empty credential-free state', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'jules-worker-test-'));
  const result = spawnSync('python3', [julesScript, 'poll'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, JULES_DB: path.join(temp, 'state.sqlite') },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SESSION\s+ACCT/);
});

test('Jules normalizes SSH remotes, handles transport errors, and excludes generated snapshots', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'jules-audit-test-'));
  mkdirSync(path.join(fixture, 'tests'), { recursive: true });
  mkdirSync(path.join(fixture, '.fleet-local/shared/tests'), { recursive: true });
  writeFileSync(path.join(fixture, 'tests/real.test.js'), '');
  writeFileSync(path.join(fixture, '.fleet-local/shared/tests/generated.test.js'), '');

  const result = python(`
import importlib.util
import sys
from pathlib import Path
from urllib.error import URLError

spec = importlib.util.spec_from_file_location('jules_worker', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.norm_repo('git@github.com:sarthak/repo.git') == 'sarthak/repo'
assert [p.relative_to(sys.argv[2]).as_posix() for p in module.discover_test_files(Path(sys.argv[2]))] == ['tests/real.test.js']

module.api_key = lambda account: 'placeholder'
module.urllib.request.urlopen = lambda *args, **kwargs: (_ for _ in ()).throw(URLError('offline'))
try:
    module.api('A', 'GET', '/sessions')
except module.ApiError as error:
    assert 'network error' in str(error)
else:
    raise AssertionError('network errors must become ApiError')
`, [julesScript, fixture]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('a repaired Jules task returns to the review queue after completion', () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'jules-review-test-'));
  const result = python(`
import argparse
import importlib.util
import os
import sys

spec = importlib.util.spec_from_file_location('jules_worker', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
connection = module.db()
connection.execute(
    "INSERT INTO tasks (account, session_id, repo, title, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ('A', 'session-1', 'owner/repo', 'test', 'COMPLETED', module.utcnow()),
)
connection.commit()
module.api = lambda *args, **kwargs: {}
module.cmd_review(argparse.Namespace(
    set='REPAIR_ONCE', session='session-1', repair='tighten assertions', notes='needs one repair'
))
connection = module.db()
connection.execute("UPDATE tasks SET status='COMPLETED' WHERE session_id='session-1'")
connection.commit()
module.cmd_review(argparse.Namespace(set=None, session=None, repair=None, notes=None))
`, [julesScript], { JULES_DB: path.join(temp, 'state.sqlite') });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /session-1/);
  assert.match(result.stdout, /awaiting review/);
});

test('Jules converts invalid JSON responses into ApiError', () => {
  const result = python(`
import importlib.util
import sys

spec = importlib.util.spec_from_file_location('jules_worker', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.api_key = lambda account: 'placeholder'

class Response:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return b'[]'

module.urllib.request.urlopen = lambda *args, **kwargs: Response()
try:
    module.api('A', 'GET', '/sessions')
except module.ApiError as error:
    assert 'invalid JSON response' in str(error)
else:
    raise AssertionError('invalid JSON must become ApiError')
`, [julesScript]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
