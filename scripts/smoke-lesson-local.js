#!/usr/bin/env node
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { FileLessonStore } from '../src/lesson-intake.js';
import { runLessonEndToEnd } from '../src/lesson-pipeline.js';

const ROOT = 'tmp/lesson-local-smoke';
const STORE_DIR = path.join(ROOT, 'store');
const WORK_DIR = path.join(ROOT, 'work');
const OUTPUT_DIR = path.join(ROOT, 'artifacts');
const REPORT_PATH = path.join(ROOT, 'report.json');

await rm(ROOT, { recursive: true, force: true });
await mkdir(ROOT, { recursive: true });

const lessonStore = new FileLessonStore({ dir: STORE_DIR });
const result = await runLessonEndToEnd({
  id: 'lesson-local-smoke',
  topic: 'JavaScript closures',
  learningObjective: 'Understand captured scope',
  keyPoints: [
    'A closure is a function plus its remembered scope',
    'Inner functions can read outer variables later',
    'Each outer call creates a fresh scope',
  ],
  cta: 'Review one closure example.',
  channel: 'tiktok',
  durationSeconds: 30,
  variantCount: 1,
}, {
  lessonStore,
  workDir: WORK_DIR,
  outputDir: OUTPUT_DIR,
  generateLessonScripts: fakeGenerateLessonScripts,
  synthesizeSceneAudio: fakeSynthesizeSceneAudio,
  fetchScenebRoll: fakeFetchSceneBroll,
  composeLesson: fakeComposeLesson,
});

const ready = result.variants?.some((variant) => variant.status === 'video_ready');
if (!ready) {
  throw new Error(`lesson local smoke did not produce a ready variant: ${JSON.stringify(result.variants)}`);
}

const report = {
  schema: 'reel-pipeline.lesson-local-smoke.v1',
  ok: true,
  lessonId: result.id,
  status: result.status,
  variantCount: result.variants.length,
  assetUrl: result.assetUrl ?? null,
  reportPath: REPORT_PATH,
  generatedAt: new Date().toISOString(),
};

await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

async function fakeGenerateLessonScripts(lesson) {
  return [{
    variantId: `${lesson.id}-v1`,
    template: 'concept_breakdown',
    hookStyle: 'pattern_interrupt',
    hook: 'Closures are not magic.',
    scenes: [
      {
        label: 'hook',
        narration: 'Closures are not magic.',
        onScreenText: 'Closures remember.',
        brollQuery: 'code editor javascript',
        durationSeconds: 3,
      },
      {
        label: 'proof',
        narration: 'An inner function keeps access to variables from the outer function.',
        onScreenText: 'Function plus scope.',
        brollQuery: 'programming lesson',
        durationSeconds: 5,
      },
      {
        label: 'cta',
        narration: lesson.cta,
        onScreenText: 'Try one example.',
        brollQuery: 'student coding',
        durationSeconds: 3,
      },
    ],
    hashtags: ['#javascript', '#coding'],
  }];
}

async function fakeSynthesizeSceneAudio(scenes, options = {}) {
  await mkdir(options.outputDir, { recursive: true });
  return Promise.all(scenes.map(async (scene, index) => {
    const audioPath = path.join(options.outputDir, `scene-${index + 1}.mp3`);
    await writeFile(audioPath, `fake audio: ${scene.narration}\n`);
    return { path: audioPath, durationSeconds: scene.durationSeconds ?? 3 };
  }));
}

async function fakeFetchSceneBroll(scenes, options = {}) {
  await mkdir(options.outputDir, { recursive: true });
  return Promise.all(scenes.map(async (scene, index) => {
    const clipPath = path.join(options.outputDir, `scene-${index + 1}.mp4`);
    await writeFile(clipPath, `fake video: ${scene.brollQuery}\n`);
    return { path: clipPath, source: 'local-smoke', durationSeconds: scene.durationSeconds ?? 3 };
  }));
}

async function fakeComposeLesson({ script, outputPath, workDir }) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(workDir, { recursive: true });
  const srtPath = path.join(workDir, 'captions.srt');
  await writeFile(outputPath, `fake lesson mp4: ${script.variantId}\n`);
  await writeFile(srtPath, '1\n00:00:00,000 --> 00:00:03,000\nClosures remember.\n');
  return {
    outputPath,
    durationSeconds: script.scenes.reduce((sum, scene) => sum + (scene.durationSeconds ?? 3), 0),
    sceneDurations: script.scenes.map((scene) => scene.durationSeconds ?? 3),
    srtPath,
  };
}
