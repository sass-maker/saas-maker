import assert from 'node:assert/strict';
import test from 'node:test';

import { selfReviewRender } from '../src/reel-self-review.js';

function probeRunner(probe) {
  return async (command) => {
    if (command.endsWith('ffprobe')) return { stdout: JSON.stringify(probe), stderr: '' };
    return { stdout: '', stderr: '' };
  };
}

const present = () => true;

test('self-review returns null when there is no local video to probe', async () => {
  const review = await selfReviewRender(
    { status: 'completed', videos: ['https://assets.example.test/reels/clip.mp4'] },
    { existsSync: present, commandRunner: probeRunner({}) },
  );
  assert.equal(review, null);
});

test('self-review passes a clean 9:16 file with audio', async () => {
  const review = await selfReviewRender(
    { status: 'completed', videos: ['/tmp/out/reel.mp4'], durationSeconds: 14 },
    {
      existsSync: present,
      commandRunner: probeRunner({
        format: { duration: '14.0' },
        streams: [
          { codec_type: 'video', width: 1080, height: 1920 },
          { codec_type: 'audio' },
        ],
      }),
    },
  );
  assert.ok(review.ok);
  assert.equal(review.issues.length, 0);
  assert.equal(review.probed.aspect, '9:16');
  assert.equal(review.probed.hasAudio, true);
  assert.equal(review.probed.durationSeconds, 14);
});

test('self-review flags wrong aspect, missing audio, and duration drift', async () => {
  const review = await selfReviewRender(
    { status: 'completed', videos: ['/tmp/out/reel.mp4'], durationSeconds: 14 },
    {
      existsSync: present,
      commandRunner: probeRunner({
        format: { duration: '9.0' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      }),
    },
  );
  assert.equal(review.ok, false);
  assert.equal(review.probed.aspect, '16:9');
  assert.ok(review.issues.some((issue) => /aspect 16:9 is not 9:16/.test(issue)));
  assert.ok(review.issues.some((issue) => /no audio track/.test(issue)));
  assert.ok(review.issues.some((issue) => /claimed duration 14s but file is 9s/.test(issue)));
});

test('self-review degrades to null when ffprobe fails', async () => {
  const review = await selfReviewRender(
    { status: 'completed', videos: ['/tmp/out/reel.mp4'] },
    {
      existsSync: present,
      commandRunner: async () => { throw new Error('ffprobe: ENOENT'); },
    },
  );
  assert.equal(review, null);
});

test('self-review returns null when the local file is missing', async () => {
  const review = await selfReviewRender(
    { status: 'completed', videos: ['/tmp/out/reel.mp4'] },
    { existsSync: () => false, commandRunner: probeRunner({}) },
  );
  assert.equal(review, null);
});
