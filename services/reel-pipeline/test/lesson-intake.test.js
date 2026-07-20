import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  FileLessonStore,
  attachLessonRender,
  attachLessonScripts,
  createLessonDraft,
  decideLessonScript,
  decideLessonVideo,
  listLessons,
  normalizeLessonInput,
} from '../src/lesson-intake.js';

async function makeStore() {
  const dir = await mkdtemp(path.join(tmpdir(), 'lesson-intake-'));
  return {
    store: new FileLessonStore({ dir }),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

test('normalizes a minimal lesson input', () => {
  const lesson = normalizeLessonInput({
    topic: 'Closures',
    learningObjective: 'Inner functions remember outer scope',
    keyPoints: ['captures variables', 'persists across calls'],
  });
  assert.equal(lesson.status, 'draft');
  assert.equal(lesson.channel, 'tiktok');
  assert.equal(lesson.durationSeconds, 60);
  assert.equal(lesson.variantCount, 1);
  assert.deepEqual(lesson.keyPoints, ['captures variables', 'persists across calls']);
  assert.match(lesson.id, /^lesson_/);
});

test('rejects missing topic / objective / keyPoints', () => {
  assert.throws(() => normalizeLessonInput({ learningObjective: 'x', keyPoints: ['y'] }), /topic is required/);
  assert.throws(() => normalizeLessonInput({ topic: 'x', keyPoints: ['y'] }), /learningObjective is required/);
  assert.throws(() => normalizeLessonInput({ topic: 'x', learningObjective: 'y', keyPoints: [] }), /keyPoints/);
});

test('rejects unknown channel and clamps duration / variant count', () => {
  assert.throws(
    () => normalizeLessonInput({ topic: 't', learningObjective: 'l', keyPoints: ['a'], channel: 'snapchat' }),
    /unsupported channel/,
  );
  const lesson = normalizeLessonInput({
    topic: 't',
    learningObjective: 'l',
    keyPoints: ['a'],
    durationSeconds: 200,
    variantCount: 12,
  });
  assert.equal(lesson.durationSeconds, 90);
  assert.equal(lesson.variantCount, 4);
});

test('lesson lifecycle: create → attach scripts → approve → attach render → approve video', async () => {
  const { store, cleanup } = await makeStore();
  try {
    const created = await createLessonDraft(
      { topic: 'Closures', learningObjective: 'Capture scope', keyPoints: ['captures', 'persists'] },
      { lessonStore: store },
    );
    assert.equal(created.status, 'draft');

    const withScripts = await attachLessonScripts(
      created.id,
      [{ variantId: `${created.id}-v1`, template: 'concept_breakdown', hook: 'hi', scenes: [{ label: 'hook', narration: 'h', brollQuery: 'q', durationSeconds: 4 }] }],
      { lessonStore: store },
    );
    assert.equal(withScripts.status, 'script_ready');
    assert.equal(withScripts.scripts.length, 1);

    const approved = await decideLessonScript(created.id, 'approve', { lessonStore: store });
    assert.equal(approved.status, 'script_approved');
    assert.equal(approved.decisions.script, 'approve');

    const rendered = await attachLessonRender(
      created.id,
      {
        variants: [
          { variantId: `${created.id}-v1`, status: 'video_ready', assetUrl: '/tmp/v1.mp4' },
        ],
        job: { id: 'job_1' },
      },
      { lessonStore: store },
    );
    assert.equal(rendered.status, 'video_ready');
    assert.equal(rendered.variants[0].assetUrl, '/tmp/v1.mp4');

    const decided = await decideLessonVideo(
      created.id,
      { decision: 'approve', variantId: `${created.id}-v1` },
      { lessonStore: store },
    );
    assert.equal(decided.status, 'ready_to_post');
    assert.equal(decided.variants[0].status, 'ready_to_post');
  } finally {
    await cleanup();
  }
});

test('listLessons filters by status and channel', async () => {
  const { store, cleanup } = await makeStore();
  try {
    await createLessonDraft(
      { topic: 'a', learningObjective: 'a', keyPoints: ['a'], channel: 'tiktok' },
      { lessonStore: store },
    );
    await createLessonDraft(
      { topic: 'b', learningObjective: 'b', keyPoints: ['b'], channel: 'instagram' },
      { lessonStore: store },
    );
    const tiktoks = await listLessons({ channel: 'tiktok' }, { lessonStore: store });
    assert.equal(tiktoks.length, 1);
    assert.equal(tiktoks[0].topic, 'a');
    const drafts = await listLessons({ status: 'draft' }, { lessonStore: store });
    assert.equal(drafts.length, 2);
  } finally {
    await cleanup();
  }
});
