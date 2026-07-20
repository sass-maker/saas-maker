import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeVideoBrief } from '../video-brief.js';
import { createRenderer } from '../pipeline.js';
import { generateScript, DEFAULT_VOICE } from './script.js';
import { normalizeKokoroVoice } from '../adapters/kokoro.js';
import { generateTitles, generateTags, buildHashtags } from './metadata.js';
import { IdeaStore } from './idea-store.js';
import { assessRender } from './quality.js';

const VOICE_ROTATION_POOL = [
  'en-US-AriaNeural-Female',
  'en-US-GuyNeural-Male',
  'en-US-JennyNeural-Female',
];

export function scriptToBrief(script, options = {}) {
  const {
    projectSlug = 'studio',
    channel = 'youtube_shorts',
    id = `studio_${slugify(script.topic)}`,
    engine = 'mock',
    voiceRotation = false,
  } = options;

  const body = [
    `Script for ${script.topic}`,
    '',
    'Scenes (shot list):',
    ...script.scenes.map((scene, index) => [
      `${index + 1}. [${scene.label}] (${scene.durationSeconds}s)`,
      `   Narration: ${scene.narration}`,
      `   Visual asset prompt: ${scene.brollQuery}`,
      scene.onScreenText ? `   Caption overlay: ${scene.onScreenText}` : '   Caption overlay: none',
    ].join('\n')),
    '',
    `Captions: auto-generated from narration, bottom position.`,
    `Hashtags: ${script.hashtags.join(' ')}`,
  ].join('\n');

  const brief = normalizeVideoBrief({
    id,
    projectSlug,
    channel,
    title: script.topic,
    hook: script.hook,
    body,
    renderMode: engine,
    durationSeconds: Math.max(5, Math.min(90, script.targetDurationSeconds)),
  });

  const baseVoice = script.voice ?? DEFAULT_VOICE;
  const voicePlan = {
    rotation: Boolean(voiceRotation),
    voice: baseVoice,
    scenes: script.scenes.map((scene, index) => ({
      label: scene.label,
      voice: voiceRotation ? VOICE_ROTATION_POOL[index % VOICE_ROTATION_POOL.length] : baseVoice,
    })),
  };

  return { brief, voicePlan };
}

export async function runFacelessWorkflow({
  topic,
  niche,
  durationSeconds = 60,
  engine = 'mock',
  voice = DEFAULT_VOICE,
  voiceRotation = false,
  voiceProfile,
  outputDir = './tmp/studio/faceless',
  postHandoff = false,
  ideaId,
  ideaStore,
  assessQuality = assessRender,
  rendererOptions = {},
  llm,
  logger = console,
} = {}) {
  if (!topic || !topic.trim()) throw new Error('topic is required');

  const isKokoroEngine = engine === 'kokoro' || engine === 'kokoro-compose';
  const effectiveVoice = isKokoroEngine ? normalizeKokoroVoice(voice) : voice;
  const script = await generateScript({ topic, niche, durationSeconds, voice: effectiveVoice, voiceProfile, llm });
  const { brief, voicePlan } = scriptToBrief(script, { engine, voiceRotation });
  const [titles, tags] = await Promise.all([
    generateTitles({ topic, llm }),
    generateTags({ topic, niche, llm }),
  ]);

  const dir = path.resolve(outputDir, slugify(topic));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'script.json'), JSON.stringify(script, null, 2));
  await writeFile(path.join(dir, 'brief.json'), JSON.stringify(brief, null, 2));
  await writeFile(path.join(dir, 'metadata.json'), JSON.stringify({
    titles: titles.data?.titles ?? titles.titles,
    tags: tags.tags,
    hashtags: script.hashtags?.length ? script.hashtags : buildHashtags(topic),
    voicePlan,
  }, null, 2));

  const engineOptions = isKokoroEngine
    ? { ...rendererOptions, kokoroCompose: { script, voice: effectiveVoice, ...(rendererOptions.kokoroCompose ?? {}) } }
    : rendererOptions;
  const renderer = rendererOptions.renderer ?? createRenderer(engine, engineOptions);
  const render = await renderer.createVideo(brief);
  await writeFile(path.join(dir, 'render.json'), JSON.stringify(render, null, 2));

  const quality = await assessQuality({ script, videoPath: render.videos?.[0] ?? null });
  await writeFile(path.join(dir, 'quality.json'), JSON.stringify(quality, null, 2));

  const store = ideaStore ?? new IdeaStore();
  const idea = ideaId
    ? await store.updateIdea(ideaId, { status: 'rendered', hook: script.hook, notes: `artifacts: ${dir}` })
    : await store.saveIdea({
      title: script.topic,
      niche: niche ?? null,
      hook: script.hook,
      status: 'rendered',
      notes: `artifacts: ${dir}`,
    });

  const summary = {
    topic: script.topic,
    scriptSource: script.source,
    engine,
    durationSeconds: script.targetDurationSeconds,
    artifactDir: dir,
    video: render.videos?.[0] ?? null,
    renderStatus: render.status,
    quality,
    ideaId: idea.id,
    voicePlan,
    postHandoff: postHandoff
      ? { note: 'render complete; post with the existing queue', command: 'npm run post:ready' }
      : null,
  };
  logger.info?.(`faceless workflow complete: ${summary.video ?? summary.renderStatus} (${dir})`);
  return summary;
}

export async function runBatch({ topics, topicsFile, ...options } = {}) {
  const list = topics ?? await loadTopicsFile(topicsFile);
  if (!Array.isArray(list) || !list.length) throw new Error('batch requires at least one topic');
  const results = [];
  for (const topic of list) {
    try {
      const summary = await runFacelessWorkflow({ ...options, topic });
      results.push({ topic, ok: true, summary });
    } catch (error) {
      results.push({ topic, ok: false, error: error.message });
    }
  }
  const summary = {
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
  if (options.outputDir) {
    const dir = path.resolve(options.outputDir);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'batch-summary.json'), JSON.stringify(summary, null, 2));
  }
  return summary;
}

async function loadTopicsFile(topicsFile) {
  if (!topicsFile) throw new Error('topics or topicsFile is required');
  const raw = await readFile(path.resolve(topicsFile), 'utf8');
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return parsed.map((entry) => (typeof entry === 'string' ? entry : entry?.topic)).filter(Boolean);
  }
  return trimmed.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}

function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'topic';
}
