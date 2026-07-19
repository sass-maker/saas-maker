import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { generateLessonScripts } from './adapters/deepseek.js';
import { synthesizeSceneAudio as synthesizeWithElevenLabs } from './adapters/elevenlabs.js';
import { synthesizeSceneAudio as synthesizeWithKokoro, isKokoroReady } from './adapters/kokoro.js';
import { fetchScenebRoll } from './adapters/pexels.js';
import { composeLesson } from './composer/lesson-composer.js';
import { attachLessonRender, attachLessonScripts, createLessonDraft, FileLessonStore } from './lesson-intake.js';

export async function generateScripts(lessonInput, options = {}) {
  const lessonStore = options.lessonStore ?? new FileLessonStore();
  const lesson = lessonInput.id
    ? await lessonStore.get(lessonInput.id) ?? (await createLessonDraft(lessonInput, { lessonStore }))
    : await createLessonDraft(lessonInput, { lessonStore });
  const scriptGenerator = options.generateLessonScripts ?? generateLessonScripts;
  const scripts = await scriptGenerator(lesson, options.deepseek ?? {});
  const updated = await attachLessonScripts(lesson.id, scripts, { lessonStore });
  return updated;
}

export function resolveTtsSynthesizer(options = {}) {
  const provider = options.ttsProvider ?? process.env.LESSON_TTS_PROVIDER
    ?? (isKokoroReady() ? 'kokoro' : 'elevenlabs');
  if (provider === 'kokoro') return synthesizeWithKokoro;
  if (provider === 'elevenlabs') return synthesizeWithElevenLabs;
  throw new Error(`unsupported LESSON_TTS_PROVIDER: ${provider} (expected kokoro or elevenlabs)`);
}

export async function renderLesson(lessonId, options = {}) {
  const lessonStore = options.lessonStore ?? new FileLessonStore();
  const lesson = await lessonStore.get(lessonId);
  if (!lesson) throw new Error(`lesson not found: ${lessonId}`);
  if (!lesson.scripts?.length) throw new Error('lesson has no scripts; run generateScripts first');
  if (!options.allowUnapproved && lesson.status !== 'script_approved') {
    throw new Error('lesson script must be approved before render');
  }

  const baseWorkDir = options.workDir ?? path.resolve(`tmp/lessons/${lesson.id}`);
  const outputDir = options.outputDir ?? path.resolve(`artifacts/lessons/${lesson.id}`);
  await mkdir(baseWorkDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const variants = [];
  const renderLog = [];
  const audioSynthesizer = options.synthesizeSceneAudio ?? resolveTtsSynthesizer(options);
  const brollFetcher = options.fetchScenebRoll ?? fetchScenebRoll;
  const lessonComposer = options.composeLesson ?? composeLesson;

  for (const script of lesson.scripts) {
    const variantWorkDir = path.join(baseWorkDir, script.variantId);
    const audioDir = path.join(variantWorkDir, 'audio');
    const brollDir = path.join(variantWorkDir, 'broll');
    const outputPath = path.join(outputDir, `${script.variantId}.mp4`);

    try {
      const sceneAudio = await audioSynthesizer(script.scenes, {
        ...(options.elevenlabs ?? {}),
        outputDir: audioDir,
        voiceId: lesson.voicePreference?.voiceId ?? options.elevenlabs?.voiceId,
        modelId: lesson.voicePreference?.modelId ?? options.elevenlabs?.modelId,
        stability: lesson.voicePreference?.stability ?? options.elevenlabs?.stability,
        similarity: lesson.voicePreference?.similarity ?? options.elevenlabs?.similarity,
      });

      const sceneClips = await brollFetcher(script.scenes, {
        ...(options.pexels ?? {}),
        outputDir: brollDir,
      });
      const missingClip = sceneClips.findIndex((entry) => !entry.path);
      if (missingClip !== -1) {
        throw new Error(`no b-roll for scene ${missingClip + 1} (query: "${script.scenes[missingClip].brollQuery}")`);
      }

      const compose = await lessonComposer({
        script,
        sceneAudio,
        sceneClips,
        workDir: variantWorkDir,
        outputPath,
        options: options.compose ?? {},
      });

      const transcriptPath = path.join(outputDir, `${script.variantId}.txt`);
      await writeFile(
        transcriptPath,
        script.scenes.map((scene, index) => `[${scene.label}] (${index + 1})\n${scene.narration}`).join('\n\n'),
      );
      const hashtagsPath = path.join(outputDir, `${script.variantId}.hashtags.txt`);
      await writeFile(hashtagsPath, (script.hashtags ?? []).join(' '));

      variants.push({
        variantId: script.variantId,
        template: script.template,
        hookStyle: script.hookStyle,
        assetUrl: outputPath,
        captionPath: compose.srtPath,
        transcriptPath,
        hashtagsPath,
        durationSeconds: compose.durationSeconds,
        sceneDurations: compose.sceneDurations,
        status: 'video_ready',
        hook: script.hook,
        hashtags: script.hashtags,
        createdAt: new Date().toISOString(),
      });
      renderLog.push(`variant ${script.variantId} ok (${compose.durationSeconds.toFixed(1)}s)`);
    } catch (error) {
      renderLog.push(`variant ${script.variantId} failed: ${error.message}`);
      variants.push({
        variantId: script.variantId,
        template: script.template,
        hookStyle: script.hookStyle,
        status: 'video_rejected',
        error: error.message,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const updated = await attachLessonRender(
    lesson.id,
    {
      variants,
      job: {
        id: `local_${lesson.id}`,
        provider: 'local-ffmpeg',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        renderLog,
      },
    },
    { lessonStore },
  );
  return updated;
}

export async function runLessonEndToEnd(lessonInput, options = {}) {
  const drafted = await generateScripts(lessonInput, options);
  return renderLesson(drafted.id, { ...options, allowUnapproved: true });
}
