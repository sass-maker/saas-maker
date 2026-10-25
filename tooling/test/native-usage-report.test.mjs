import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readAggregate, usageBundle, validateAggregate } from '../scripts/native-usage-report.mjs';

const now = '2026-10-26T12:00:00.000Z';
function fixture() {
  return { schemaVersion: 1, projectId: 'kith', coverageStartedAtISO: '2026-09-01T00:00:00Z', updatedAtISO: now, timeZoneIdentifier: 'Asia/Kolkata', days: [{ date: '2026-10-25', counters: { result_opened: 2 }, durationTotalsSeconds: {}, durationSamples: {} }] };
}
test('observed device proxy stays separate from human utility and exact event time', () => {
  const r = usageBundle(fixture(), 'kith', now).usage.records.kith;
  assert.deepEqual(r.proxy, { count: 1, unit: 'devices', precision: 'lower_bound' });
  assert.equal(r.core.qualified, false); assert.equal(r.core.count, null);
  assert.deepEqual(r.events, [{ name: 'result_opened', count: 2, lastSeen: null, precision: 'exact' }]);
  assert.equal(Date.parse(r.windowEnd) - Date.parse(r.windowStart), 30 * 86400000);
});
test('empty and unavailable sources stay unknown, never become zero MAU', () => {
  const empty = fixture(); empty.days = [];
  for (const input of [null, empty]) assert.equal(usageBundle(input, 'kith', now).usage.records.kith.proxy.count, null);
  assert.equal(usageBundle(null, 'kith', now).usage.records.kith.tracking, 'missing');
  assert.throws(() => usageBundle(null, 'INVALID_PRIVATE_ID', now), /Invalid project/);
});
test('first ambiguous local date is excluded rather than pulled into the rolling window', () => {
  const input = fixture(); input.days[0].date = '2026-09-26';
  assert.equal(usageBundle(input, 'kith', now).usage.records.kith.proxy.count, null);
  input.days[0].date = '2026-09-28';
  assert.equal(usageBundle(input, 'kith', now).usage.records.kith.proxy.count, 1);
});
test('rejects content, identifiers, unknown counter names and malformed amounts without echoing input', () => {
  for (const modify of [x => { x.notes = 'PRIVATE_SENTINEL'; }, x => { x.days[0].personId = 'PRIVATE_SENTINEL'; }, x => { x.days[0].counters.PRIVATE_SENTINEL = 1; }, x => { x.days[0].counters.result_opened = -1; }, x => { x.days[0].counters.result_opened = 0.5; }, x => { x.timeZoneIdentifier = 'PRIVATE_SENTINEL'; }]) {
    const input = fixture(); modify(input);
    assert.throws(() => validateAggregate(input, 'kith', now), e => !e.message.includes('PRIVATE_SENTINEL'));
  }
});
test('rejects mismatched identity, future or invalid dates, duplicates, stale update ordering and totals overflow', () => {
  for (const modify of [x => { x.projectId = 'calorie'; }, x => { x.days[0].date = '2026-02-30'; }, x => { x.days[0].date = '2026-10-28'; }, x => { x.days.push(structuredClone(x.days[0])); }, x => { x.coverageStartedAtISO = '2026-10-27T00:00:00Z'; }, x => { x.updatedAtISO = '2026-10-27T00:00:00Z'; }]) {
    const input = fixture(); modify(input); assert.throws(() => usageBundle(input, 'kith', now));
  }
  const input = fixture(); input.days[0].counters.result_opened = Number.MAX_SAFE_INTEGER;
  input.days.push({ ...structuredClone(input.days[0]), date: '2026-10-24' });
  assert.throws(() => usageBundle(input, 'kith', now), /overflow/);
  assert.throws(() => usageBundle(fixture(), 'kith', '2026-10-26T12:00:00.1234567890Z'), /timestamp/);
});
test('CLI refuses missing inputs and unsafe FIFO files, emits only valid explicit reports and preserves existing output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'native-aggregate-cli-'));
  const file = join(dir, 'interaction-metrics-v1.json');
  const script = fileURLToPath(new URL('../scripts/native-usage-report.mjs', import.meta.url));
  const run = (...extra) => spawnSync(process.execPath, [script, '--input', file, '--project', 'kith', '--now', now, ...extra], { encoding: 'utf8', timeout: 5000 });
  try {
    const missing = run(); assert.equal(missing.status, 1); assert.equal(missing.stdout, '');
    if (process.platform !== 'win32') {
      const made = spawnSync('mkfifo', [file], { encoding: 'utf8' }); assert.equal(made.status, 0);
      const fifo = run(); assert.equal(fifo.status, 1); assert.equal(fifo.stdout, '');
      await rm(file);
    }
    await writeFile(file, JSON.stringify(fixture()));
    const valid = run(); assert.equal(valid.status, 0); assert.equal(JSON.parse(valid.stdout).usage.records.kith.proxy.count, 1);
    const output = join(dir, 'report.json'); await writeFile(output, 'existing-evidence');
    assert.equal(run('--output', output).status, 1); assert.equal(await readFile(output, 'utf8'), 'existing-evidence');
    const bad = fixture(); bad.timeZoneIdentifier = 'PRIVATE_SENTINEL'; await writeFile(file, JSON.stringify(bad));
    const rejected = run(); assert.equal(rejected.status, 1); assert.equal(rejected.stdout, ''); assert(!rejected.stderr.includes('PRIVATE_SENTINEL'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('reader uses only the named regular sidecar, rejects symlinks and journals, and preserves inputs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'native-aggregate-test-'));
  const file = join(dir, 'interaction-metrics-v1.json');
  try {
    const text = JSON.stringify(fixture()); await writeFile(file, text);
    assert.deepEqual(await readAggregate(file), fixture()); assert.equal(await readFile(file, 'utf8'), text);
    await assert.rejects(readAggregate(join(dir, 'journal.json')));
    assert.equal(await readAggregate(join(dir, 'missing', 'interaction-metrics-v1.json')), null);
    const linkDir = join(dir, 'linked'); await mkdir(linkDir);
    const linkFile = join(linkDir, 'interaction-metrics-v1.json'); await symlink(file, linkFile);
    await assert.rejects(readAggregate(linkFile));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
