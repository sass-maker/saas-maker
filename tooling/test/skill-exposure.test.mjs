import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);

test('audit counts entrypoints, honors explicit-only policy, and separates cache duplicates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-audit-test-'));
  const codex = path.join(dir, '.codex');
  const fleet = path.join(dir, 'fleet');
  const add = (base, name) => {
    const folder = path.join(base, name);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'SKILL.md'), `---\nname: ${name}\ndescription: Test capability\n---\n`);
    return folder;
  };
  const local = add(path.join(codex, 'skills'), 'example');
  fs.mkdirSync(path.join(local, 'agents'));
  fs.writeFileSync(path.join(local, 'agents/openai.yaml'), 'policy:\n  allow_implicit_invocation: false\n');
  fs.symlinkSync(local, path.join(local, 'self'));
  const cached = add(path.join(codex, 'plugins/cache/vendor/version'), 'example');
  fs.symlinkSync(cached, path.join(cached, 'self'));
  add(path.join(fleet, 'saas-maker/tooling/skills'), 'example');
  const script = fs.readFileSync(new URL('skills/token-budget/scripts/token-budget.sh', root), 'utf8');
  const python = script.split("python3 <<'PY'\n")[1].split('\nPY\n')[0];
  const result = spawnSync('python3', ['-c', python], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, HOME: dir, CODEX_HOME: codex, FLEET_ROOT: fleet, AUDIT_TARGET: fleet },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Codex user\s+1 skills/);
  assert.match(result.stdout, /Explicit-only: 1; implicit-eligible description chars: 0/);
  assert.match(result.stdout, /Plugin disk cache \(not startup\)\s+1 skills/);
  assert.match(result.stdout, /Fleet catalog \(not exposure\)\s+1 skills/);
  assert.match(result.stdout, /excluding cache\/catalog\): 0/);
});

test('repeat skill linking is idempotent and preserves a real destination directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-link-test-'));
  const source = path.join(dir, 'tooling/skills/example');
  const destination = path.join(dir, 'exposed');
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(destination);
  const script = fs.readFileSync(new URL('scripts/agent-stack.sh', root), 'utf8');
  const functions = script.slice(script.indexOf('is_exposed_fleet_skill()'), script.indexOf('link_teammate_parent()'));
  const run = () => spawnSync('bash', ['-c', `${functions}\nEXPOSED_FLEET_SKILLS=(example)\nlink_fleet_skills "$DEST"`], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, FLEET_OPS_DIR: path.join(dir, 'tooling'), LEGACY_FLEET_OPS_DIR: path.join(dir, 'legacy'), DEST: destination },
  });
  assert.equal(run().status, 0);
  assert.equal(run().status, 0);
  assert.equal(fs.readlinkSync(path.join(destination, 'example')), source);
  assert.deepEqual(fs.readdirSync(source), []);
  // Move the test link aside; no source or user content is removed.
  fs.renameSync(path.join(destination, 'example'), path.join(dir, 'saved-link'));
  fs.mkdirSync(path.join(destination, 'example'));
  fs.writeFileSync(path.join(destination, 'example/keep.txt'), 'user content');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(path.join(destination, 'example/keep.txt'), 'utf8'), 'user content');
});
