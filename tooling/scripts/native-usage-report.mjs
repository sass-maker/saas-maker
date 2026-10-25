import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DAY = 86_400_000;
const MAX_BYTES = 262_144;
const COUNTERS = new Set([
  'search_attempt', 'search_no_results', 'result_opened', 'log_editor_opened',
  'log_save_succeeded', 'log_save_failed', 'log_canceled', 'log_abandoned',
  'log_form_opened', 'log_saved', 'log_cancelled', 'entry_edit_opened',
  'entry_edit_saved', 'entry_edit_cancelled', 'entry_edit_save_failed',
]);
const DURATIONS = new Set(['log_editor_foreground_elapsed', 'log_form_elapsed', 'entry_edit_elapsed']);
function object(value, keys) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Invalid aggregate object.');
  assert(Object.keys(value).every((key) => keys.includes(key)), 'Unexpected aggregate field.');
}
function timestamp(value) {
  assert(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value), 'Invalid aggregate timestamp.');
  const time = Date.parse(value);
  assert(Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19), 'Invalid aggregate timestamp.');
  return time;
}
function amounts(value, allowed, integer) {
  object(value, [...allowed]);
  for (const amount of Object.values(value)) {
    assert(typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER && (!integer || Number.isSafeInteger(amount)), 'Invalid aggregate amount.');
  }
}

/** Strict content-free sidecar contract. Never accept a journal/document export. */
export function validateAggregate(input, project, now) {
  assert(/^[a-z][a-z0-9-]{0,63}$/.test(project), 'Invalid project identifier.');
  const end = timestamp(now);
  object(input, ['schemaVersion', 'projectId', 'coverageStartedAtISO', 'updatedAtISO', 'timeZoneIdentifier', 'days']);
  assert(input.schemaVersion === 1 && input.projectId === project, 'Aggregate project/schema mismatch.');
  assert(timestamp(input.coverageStartedAtISO) <= timestamp(input.updatedAtISO) && timestamp(input.updatedAtISO) <= end, 'Invalid aggregate coverage.');
  assert(typeof input.timeZoneIdentifier === 'string' && input.timeZoneIdentifier.length <= 100, 'Invalid aggregate timezone.');
  try { new Intl.DateTimeFormat('en', { timeZone: input.timeZoneIdentifier }); }
  catch { throw new Error('Invalid aggregate timezone.'); }
  assert(Array.isArray(input.days) && input.days.length <= 730, 'Invalid aggregate day count.');
  const dates = new Set();
  for (const day of input.days) {
    object(day, ['date', 'counters', 'durationTotalsSeconds', 'durationSamples']);
    assert(typeof day.date === 'string' && /^\d{4}-\d\d-\d\d$/.test(day.date), 'Invalid aggregate date.');
    const time = Date.parse(`${day.date}T00:00:00.000Z`);
    assert(Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day.date && !dates.has(day.date), 'Invalid or duplicate aggregate date.');
    // A local date may be up to 14 hours ahead of UTC; no actual event may be future-dated.
    assert(time - 14 * 3_600_000 <= timestamp(input.updatedAtISO), 'Future aggregate date.');
    dates.add(day.date);
    amounts(day.counters, COUNTERS, true);
    amounts(day.durationTotalsSeconds, DURATIONS, false);
    amounts(day.durationSamples, DURATIONS, true);
  }
  return input;
}

/** The bounded UTC report contains device activity proxies, never proven people or utility. */
export function usageBundle(input, project, now = new Date().toISOString()) {
  assert(typeof project === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(project), 'Invalid project identifier.');
  const end = timestamp(now);
  const start = end - 30 * DAY;
  const totals = new Map();
  let activeDays = 0;
  if (input !== null) {
    validateAggregate(input, project, now);
    for (const day of input.days) {
      // Exclude the ambiguous first local date: even UTC+14 activity must fit inside the window.
      if (Date.parse(`${day.date}T00:00:00.000Z`) - 14 * 3_600_000 < start) continue;
      if (Object.values(day.counters).some((count) => count > 0)) activeDays++;
      for (const [name, count] of Object.entries(day.counters)) {
        const total = (totals.get(name) ?? 0) + count;
        assert(Number.isSafeInteger(total), 'Aggregate count overflow.');
        totals.set(name, total);
      }
    }
  }
  const record = {
    windowStart: new Date(start).toISOString(), windowEnd: now, checkedAt: now,
    proxy: { count: activeDays > 0 ? 1 : null, unit: 'devices', precision: activeDays > 0 ? 'lower_bound' : 'unknown' },
    core: { count: null, definition: 'Local interaction proxies do not establish useful recall, comprehension or benefit.', lastUsedAt: null, qualified: false, precision: 'unknown', coverage: input === null ? 'unknown' : 'partial' },
    tracking: input === null ? 'missing' : 'partial',
    evidence: [{ source: 'native.local-interactions', date: now, note: input === null ? 'No explicit local aggregate is available; usage is unknown.' : `Content-free local aggregate; ${activeDays} observed activity days in conservatively included date buckets. Coverage began ${input.coverageStartedAtISO}; latest aggregate write ${input.updatedAtISO}.` }],
    limitations: 'One device-local sidecar only; no cross-device identity, natural-user attribution or QA guarantee. Synthetic fixture paths must be separated by the producing app. Only counters are observed; no completed core outcome or human benefit is inferred. Daily dates cannot provide exact rolling timestamps: ambiguous first-day activity is omitted and collection coverage remains partial. No recorded activity means unknown, not zero use. No historical activity is reconstructed.',
    events: [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count, lastSeen: null, precision: 'exact' })),
  };
  return { kind: 'portfolio-usage', schemaVersion: 1, usage: { schemaVersion: 1, updatedAt: now, records: { [project]: record } } };
}

export async function readAggregate(file) {
  assert(basename(file) === 'interaction-metrics-v1.json', 'Only an explicitly selected interaction sidecar may be read.');
  let handle;
  try {
    assert(Number.isInteger(constants.O_NOFOLLOW) && Number.isInteger(constants.O_NONBLOCK), 'Safe file flags unavailable.');
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await handle.stat();
    assert(stat.isFile() && stat.size <= MAX_BYTES, 'Invalid aggregate file.');
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < bytes.length) {
      const { bytesRead } = await handle.read(bytes, size, bytes.length - size, size);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    assert(size <= MAX_BYTES, 'Invalid aggregate size.');
    return JSON.parse(bytes.subarray(0, size).toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Cannot read a valid content-free interaction sidecar.');
  } finally { await handle?.close(); }
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node native-usage-report.mjs --input FILE --project ID [--output NEW_FILE] [--now UTC_ISO]\nReads only an explicit interaction-metrics-v1.json sidecar; no scan or network.\nEmits a private portfolio-usage import with partial device activity proxies, not people or core-use qualification.\nMissing inputs fail without producing an import; existing output files are preserved.');
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    assert(['--input', '--project', '--output', '--now'].includes(args[i]) && args[i + 1] && !Object.hasOwn(options, args[i]), 'Expected --input FILE --project ID [--output FILE] [--now UTC_ISO].');
    options[args[i]] = args[i + 1];
  }
  assert(options['--input'] && options['--project'], 'An explicit sidecar and project are required.');
  if (options['--output']) assert(resolve(options['--input']) !== resolve(options['--output']), 'Output must differ from input.');
  const input = await readAggregate(options['--input']);
  assert(input !== null, 'Explicit aggregate input is missing; preserve earlier usage evidence.');
  const bundle = usageBundle(input, options['--project'], options['--now']);
  const result = `${JSON.stringify(bundle, null, 2)}\n`;
  if (options['--output']) await writeFile(options['--output'], result, { mode: 0o600, flag: 'wx' });
  else process.stdout.write(result);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => { console.error('Native aggregate report failed; input data and paths were not printed.'); process.exitCode = 1; });
}
