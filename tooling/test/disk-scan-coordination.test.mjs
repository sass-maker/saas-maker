import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { AgentWorkspaces } from '../lib/agent-workspaces.mjs';

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const library = new URL('../lib/agent-workspaces.mjs', import.meta.url).href;

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'fleet-scan-coordination-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'state');
  const manager = new AgentWorkspaces({ root });
  manager.initialize();
  for (let index = 0; index < 8; index++) {
    const tree = join(root, 'retired', `tree-${index}`);
    mkdirSync(tree); writeFileSync(join(tree, 'data'), 'initial');
  }
  const bin = join(base, 'bin'); mkdirSync(bin);
  const ledger = join(base, 'ledger');
  writeFileSync(join(bin, 'du'), `#!${process.execPath}
import { appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const path = process.argv.at(-1);
if (path.includes('/retired/tree-')) {
  const log = (event) => appendFileSync(process.env.SCAN_LEDGER, JSON.stringify({ event, pid: process.pid, path }) + '\\n');
  log('start');
  await new Promise(done => setTimeout(done, 500));
  if (existsSync(process.env.SCAN_FAILURE)) { log('end'); console.error('du: permission denied'); process.exit(1); }
  process.stdout.write(execFileSync('/usr/bin/du', process.argv.slice(2)));
  log('end');
} else process.stdout.write(execFileSync('/usr/bin/du', process.argv.slice(2)));
`, { mode: 0o700 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SCAN_LEDGER: ledger, SCAN_FAILURE: join(base, 'failure') };
  const events = () => existsSync(ledger) ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  function caller() {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import { AgentWorkspaces } from ${JSON.stringify(library)};
      const manager = new AgentWorkspaces({ root: ${JSON.stringify(root)} });
      try { console.log(JSON.stringify(await manager.measureBudgets(${JSON.stringify(join(root, 'absent'))}, 'fixture'))); }
      catch (error) { console.error(error.message); process.exitCode = 1; }
    `], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (part) => { stdout += part; }); child.stderr.on('data', (part) => { stderr += part; });
    const result = new Promise((done, fail) => {
      child.on('error', fail);
      child.on('close', (code) => done({ code, stdout, stderr }));
    });
    return { child, result };
  }
  return { root, manager, env, events, caller };
}

async function until(predicate) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) { assert.ok(Date.now() < deadline, 'fixture reached the scanner work boundary'); await pause(20); }
}

test('overlapping separate callers traverse retired entries once; later calls measure growth afresh', async (t) => {
  const f = fixture(t);
  const first = f.caller();
  await until(() => f.events().some((event) => event.event === 'start'));
  const second = f.caller();
  const results = await Promise.all([first.result, second.result]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 8, 'overlapping callers share one complete retired traversal');
  let active = 0; let peak = 0;
  for (const event of f.events()) { active += event.event === 'start' ? 1 : -1; peak = Math.max(peak, active); }
  assert.ok(peak <= 4, `one retired pool has at most four du children; observed ${peak}`);
  const before = JSON.parse(results[0].stdout).total;
  writeFileSync(join(f.root, 'retired', 'tree-0', 'growth'), Buffer.alloc(128 * 1024));
  const later = await f.caller().result;
  assert.equal(later.code, 0, later.stderr);
  assert.ok(JSON.parse(later.stdout).total > before, 'non-overlapping invocation sees newly allocated bytes');
  assert.equal(f.events().filter((event) => event.event === 'start').length, 16, 'completed totals are never reused by a later caller');
});
