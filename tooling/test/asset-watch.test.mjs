import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { relevant, projects, worktrees, enqueue, complete, start } from '../launchkit/scripts/asset-watch.mjs';

test('ignores generated files and secrets while observing source edits', () => {
  assert.equal(relevant('src/logo.svg'), true);
  for (const path of ['node_modules/a.js', '.git/index', 'src/.env.production', '../secret', '/tmp/a', '']) assert.equal(relevant(path), false);
});

test('finds active projects including newly catalogued products and their worktrees', () => {
  const catalog = { projects: [
    { id: 'new', lifecycle: { portfolioStatus: 'active' }, repositories: { localPath: 'new' } },
    { id: 'old', lifecycle: { portfolioStatus: 'archived' }, repositories: { localPath: 'old' } },
  ] };
  assert.deepEqual(projects(catalog, { products: [] }, '/fleet'), [{ id: 'new', path: '/fleet/new' }]);
  assert.deepEqual(worktrees('/fleet/new', () => 'worktree /fleet/new\nHEAD abc\n\nworktree /elsewhere/writer\nHEAD def\n'), ['/fleet/new', '/elsewhere/writer']);
});

test('preserves newer changes when a prior run completes and backs off failed work', () => {
  const state = { pending: {} };
  enqueue(state, 'a', 1);
  const selected = { a: state.pending.a.generation };
  enqueue(state, 'a', 2);
  complete(state, selected, true, 3);
  assert.equal(state.pending.a.generation, 2);
  complete(state, { a: 2 }, false, 100);
  assert.equal(state.pending.a.retryAt, 60100);
  complete(state, { a: 2 }, true, 60101);
  assert.deepEqual(state.pending, {});
});

test('a real source edit queues and invokes the worker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'asset-watch-test-'));
  const project = join(root, 'project');
  mkdirSync(project); mkdirSync(join(root, 'site-health/catalog'), { recursive: true });
  execFileSync('git', ['init', '-q', project]);
  writeFileSync(join(root, 'site-health/catalog/projects.json'), JSON.stringify({ projects: [
    { id: 'example', lifecycle: { portfolioStatus: 'active' }, repositories: { localPath: 'project' } },
  ] }));
  const index = join(root, 'index.json'); writeFileSync(index, '{"products":[]}');
  const worker = join(root, 'fake-codex');
  writeFileSync(worker, '#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\nprintf "SUCCESS\\n" > "$2"\n', { mode: 0o700 });
  const stateDir = join(root, 'state');
  const stop = start({ fleetRoot: root, indexPath: index, stateDir, codexPath: worker, debounceMs: 100, tickMs: 50 });
  try {
    await delay(200);
    writeFileSync(join(project, 'logo.svg'), '<svg/>');
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (existsSync(join(stateDir, 'state.json'))) {
        const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
        if (!state.pending.example) return;
      }
      await delay(50);
    }
    assert.fail('the queued change was not completed');
  } finally { stop(); }
});
