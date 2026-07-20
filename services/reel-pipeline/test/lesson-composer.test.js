import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSrtFromScenes, splitNarrationLines, toSrtTimestamp } from '../src/composer/captions.js';

test('toSrtTimestamp formats hours/minutes/seconds/ms', () => {
  assert.equal(toSrtTimestamp(0), '00:00:00,000');
  assert.equal(toSrtTimestamp(1.5), '00:00:01,500');
  assert.equal(toSrtTimestamp(61.25), '00:01:01,250');
  assert.equal(toSrtTimestamp(3661.001), '01:01:01,001');
});

test('splitNarrationLines splits on sentence ends and chunks long lines', () => {
  assert.deepEqual(splitNarrationLines('Hi. Hello world.'), ['Hi.', 'Hello world.']);
  const lines = splitNarrationLines(
    'A closure is when an inner function remembers the outer scope variables across calls.',
  );
  assert.ok(lines.length >= 2);
  for (const line of lines) {
    assert.ok(line.length <= 40, `line too long: ${line}`);
  }
  assert.deepEqual(splitNarrationLines(''), []);
});

test('buildSrtFromScenes produces sequential numbered entries with correct timing', () => {
  const scenes = [
    { narration: 'Hi.' },
    { narration: 'A closure remembers scope. It is simple.' },
    { narration: 'Follow now.' },
  ];
  const durations = [2, 6, 2];
  const srt = buildSrtFromScenes(scenes, durations);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:02,000\nHi\.\n/);
  assert.match(srt, /2\n00:00:02,000 --> 00:00:05,000\nA closure remembers scope\.\n/);
  assert.match(srt, /4\n00:00:08,000 --> 00:00:10,000\nFollow now\.\n/);
});
