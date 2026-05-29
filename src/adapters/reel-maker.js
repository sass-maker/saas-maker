import { execFile } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { ProductProofCapture } from '../product-proof-capture.js';
import { getTemplate, selectTemplate } from '../reel-templates.js';

const execFileAsync = promisify(execFile);
const DEFAULT_ENGINE_DIR = './engines/reel-maker';
const SCENE_COUNT = 3;

export class ReelMakerAdapter {
  constructor(options = {}) {
    this.engineDir = path.resolve(options.engineDir ?? process.env.REEL_MAKER_ENGINE_DIR ?? DEFAULT_ENGINE_DIR);
    this.commandRunner = options.commandRunner ?? defaultCommandRunner;
    this.now = options.now ?? (() => new Date());
    this.productProofCapture = options.productProofCapture ?? null;
    this.skipRemotionRender = options.skipRemotionRender ?? false;
    this.logger = options.logger ?? noopLogger;
  }

  async createVideo(brief, runOptions = {}) {
    const variantId = runOptions.variantId ?? null;
    const slug = stableSlug(`${brief.projectSlug}-${brief.id}${variantId ? `-${variantId}` : ''}`);
    const contentDir = path.join(this.engineDir, 'public', 'content', slug);
    const outPath = path.join(this.engineDir, 'out', `${slug}.mp4`);
    await mkdir(path.join(contentDir, 'images'), { recursive: true });
    await mkdir(path.join(contentDir, 'audio'), { recursive: true });
    await mkdir(path.dirname(outPath), { recursive: true });

    const template = runOptions.template
      ? getTemplate(runOptions.template) ?? selectTemplate(brief)
      : selectTemplate(brief);

    const renderLog = [`template=${template.id}`];

    let proof = null;
    if (this.productProofCapture) {
      try {
        proof = await this.productProofCapture.capture(brief, {
          variantId,
          preferRecording: template.id === 'mini_demo',
        });
        if (proof) renderLog.push(`proof=${proof.proofType} via ${proof.type}`);
      } catch (error) {
        renderLog.push(`proof_capture_failed: ${formatError(error)}`);
        this.logger.warn?.('product proof capture failed', error);
      }
    }

    const proofImages = await materializeProofImages(proof, contentDir, this.commandRunner);
    const scenes = splitBriefIntoScenes(brief, { template, hookOverride: runOptions.hook, ctaOverride: runOptions.cta });
    const timeline = { shortTitle: brief.title, elements: [], text: [], audio: [], style: reelStyle(), template: template.id };
    let offsetMs = 0;

    for (let index = 0; index < scenes.length; index += 1) {
      const uid = `scene-${index + 1}`;
      const imagePath = path.join(contentDir, 'images', `${uid}.png`);
      const audioPath = path.join(contentDir, 'audio', `${uid}.mp3`);
      await createSceneImage({
        imagePath,
        sceneIndex: index,
        scene: scenes[index],
        template,
        proofImage: pickProofImage(proofImages, scenes[index], index),
        commandRunner: this.commandRunner,
      });
      const durationMs = await createSceneAudio(audioPath, scenes[index].voiceover, this.commandRunner);
      timeline.elements.push(backgroundElement(uid, offsetMs, durationMs, index));
      timeline.audio.push({ audioUrl: uid, startMs: offsetMs, endMs: offsetMs + durationMs });
      timeline.text.push({
        startMs: offsetMs,
        endMs: offsetMs + durationMs,
        position: 'bottom',
        captions: timedCaptions(scenes[index].caption, offsetMs, durationMs),
      });
      offsetMs += durationMs;
    }

    await writeFile(path.join(contentDir, 'timeline.json'), `${JSON.stringify(timeline, null, 2)}\n`);
    await writeFile(path.join(contentDir, 'descriptor.json'), `${JSON.stringify({
      shortTitle: brief.title,
      content: scenes,
      template: template.id,
      proofType: proof?.proofType ?? 'generated_card',
      proofPaths: proof?.paths ?? [],
    }, null, 2)}\n`);

    if (!this.skipRemotionRender) {
      try {
        await this.commandRunner('bunx', remotionRenderArgs(slug, outPath), { cwd: this.engineDir, timeout: 300_000 });
      } catch (error) {
        renderLog.push(`remotion_render_failed: ${formatError(error)}`);
        await writeFile(outPath, `remotion render placeholder for ${slug}\n`);
      }
    } else {
      await writeFile(outPath, `mock reel-maker render for ${slug}\n`);
    }

    const thumbnailPath = path.join(contentDir, 'images', 'scene-1.png');
    const durationSeconds = Math.round(offsetMs / 100) / 10;

    return {
      provider: 'reel-maker',
      externalTaskId: `reelmaker_${slug}_${this.now().getTime()}`,
      status: 'completed',
      videos: [outPath],
      thumbnail: thumbnailPath,
      durationSeconds,
      template: { id: template.id, label: template.label },
      proofType: proof?.proofType ?? 'generated_card',
      proofPaths: proof?.paths ?? [],
      captionText: scenes.map((scene) => scene.caption).filter(Boolean).join(' / '),
      variantId,
      renderLog,
      raw: {
        slug,
        timelinePath: path.join(contentDir, 'timeline.json'),
        aspect: '9:16',
        durationSeconds,
        template: template.id,
        proof: proof
          ? { type: proof.type, proofType: proof.proofType, reasons: proof.reasons, paths: proof.paths }
          : null,
      },
    };
  }
}

export function splitBriefIntoScenes(brief, options = {}) {
  const template = options.template ?? selectTemplate(brief);
  const hook = options.hookOverride ?? brief.hook;
  const cta = options.ctaOverride ?? brief.cta ?? 'Try it on one real workflow.';
  const proofLine = proofCaption(brief.body);
  const captions = {
    hook,
    proof: proofLine,
    cta,
    before: 'Before — the messy current state.',
    after: proofLine,
    changelog: brief.changelogEntryId ? `Shipped: ${brief.changelogEntryId}` : 'Just shipped.',
    claim: hook,
    evidence: proofLine,
    step1: brief.demoSteps?.[0]?.caption ?? 'Open the product.',
    step2: brief.demoSteps?.[1]?.caption ?? 'Do one thing.',
    step3: brief.demoSteps?.[2]?.caption ?? 'See the result.',
  };
  const scenes = (template.scenes ?? []).slice(0, SCENE_COUNT).map((scene, index) => {
    const captionKey = scene.caption ?? 'proof';
    const caption = captions[captionKey] ?? proofLine;
    return {
      label: scene.label,
      caption,
      voiceover: concise(caption),
      visual: scene.label,
      source: scene.source ?? 'product_visual',
      index,
    };
  });
  if (scenes.length === 0) {
    return [
      { label: 'Pain', caption: hook, voiceover: concise(hook), visual: 'Pain', source: 'hook', index: 0 },
      { label: 'Proof', caption: proofLine, voiceover: concise(proofLine), visual: 'Proof', source: 'product_visual', index: 1 },
      { label: 'Action', caption: cta, voiceover: concise(cta), visual: 'Action', source: 'cta_card', index: 2 },
    ];
  }
  return scenes;
}

async function materializeProofImages(proof, contentDir, commandRunner) {
  if (!proof || !Array.isArray(proof.paths) || proof.paths.length === 0) return [];
  const proofImages = [];
  for (let index = 0; index < proof.paths.length; index += 1) {
    const sourcePath = proof.paths[index];
    if (!sourcePath) continue;
    if (/\.(mp4|webm|mov)$/i.test(sourcePath)) {
      const framePath = path.join(contentDir, 'images', `proof-${index + 1}.png`);
      try {
        await commandRunner(
          'ffmpeg',
          ['-y', '-ss', '0.8', '-i', sourcePath, '-vframes', '1', '-vf', 'scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920', framePath],
          { timeout: 60_000 },
        );
        proofImages.push(framePath);
      } catch {
        // ignore failed frame extraction
      }
    } else {
      const destination = path.join(contentDir, 'images', `proof-${index + 1}.png`);
      try {
        await commandRunner(
          'ffmpeg',
          ['-y', '-i', sourcePath, '-vf', 'scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920', destination],
          { timeout: 60_000 },
        );
        proofImages.push(destination);
      } catch {
        try {
          await copyFile(sourcePath, destination);
          proofImages.push(destination);
        } catch {
          // skip if source cannot be copied
        }
      }
    }
  }
  return proofImages;
}

function pickProofImage(proofImages, scene, index) {
  if (!proofImages.length) return null;
  if (scene.source === 'product_visual' || scene.source === 'demo_step_2') return proofImages[index] ?? proofImages[0];
  if (scene.source === 'demo_step_1') return proofImages[0];
  if (scene.source === 'demo_step_3') return proofImages[proofImages.length - 1];
  return null;
}

function backgroundElement(uid, offsetMs, durationMs, index) {
  return {
    imageUrl: uid,
    startMs: offsetMs,
    endMs: offsetMs + durationMs,
    enterTransition: 'blur',
    exitTransition: 'blur',
    animations: [{ type: 'scale', from: index % 2 === 0 ? 1.12 : 1, to: index % 2 === 0 ? 1 : 1.12, startMs: 0, endMs: durationMs }],
  };
}

async function createSceneImage({ imagePath, sceneIndex, scene, template, proofImage, commandRunner }) {
  if (proofImage) {
    try {
      await commandRunner('ffmpeg', ['-y', '-i', proofImage, '-vf', 'scale=1080:1920:force_original_aspect_ratio=cover,crop=1080:1920', imagePath], { timeout: 60_000 });
      return;
    } catch {
      try { await copyFile(proofImage, imagePath); return; } catch { /* fall through */ }
    }
  }
  await renderGeneratedCard({ imagePath, sceneIndex, template, commandRunner });
}

async function renderGeneratedCard({ imagePath, sceneIndex, template, commandRunner }) {
  const palette = paletteForTemplate(template, sceneIndex);
  const filter = [
    `color=c=${palette[0]}:s=1080x1920:d=1`,
    `drawbox=x=72:y=120:w=936:h=1680:color=${palette[1]}@0.18:t=fill`,
    `drawbox=x=72:y=120:w=936:h=1680:color=${palette[1]}@0.78:t=8`,
    'drawbox=x=132:y=240:w=816:h=420:color=white@0.08:t=fill',
    'drawbox=x=132:y=760:w=816:h=760:color=black@0.28:t=fill',
    'drawbox=x=192:y=1040:w=696:h=310:color=white@0.10:t=fill',
    `drawbox=x=232:y=1090:w=616:h=70:color=${palette[1]}@0.75:t=fill`,
    'drawbox=x=232:y=1200:w=420:h=34:color=white@0.25:t=fill',
    'drawbox=x=232:y=1270:w=520:h=34:color=white@0.18:t=fill',
  ].join(',');
  try {
    await commandRunner('ffmpeg', ['-y', '-f', 'lavfi', '-i', filter, '-frames:v', '1', imagePath], { timeout: 60_000 });
  } catch {
    await writeFile(imagePath, `generated card placeholder ${sceneIndex}\n`);
  }
}

function paletteForTemplate(template, sceneIndex) {
  const palettes = {
    problem_proof_cta: [['0x08111f', '0x22d3ee'], ['0x130b1f', '0xa78bfa'], ['0x101607', '0xbef264']],
    before_after: [['0x1c1917', '0xf87171'], ['0x0c4a6e', '0x60a5fa'], ['0x14532d', '0x86efac']],
    changelog_proof: [['0x0f172a', '0xfbbf24'], ['0x1e293b', '0x38bdf8'], ['0x111827', '0xa78bfa']],
    mini_demo: [['0x09090b', '0x22d3ee'], ['0x111827', '0xa3e635'], ['0x18181b', '0xf472b6']],
    teardown_audit: [['0x0c0a09', '0xfacc15'], ['0x1c1917', '0xf87171'], ['0x18181b', '0x60a5fa']],
  };
  const set = palettes[template.id] ?? palettes.problem_proof_cta;
  return set[sceneIndex % set.length];
}

async function createSceneAudio(audioPath, text, commandRunner) {
  const aiffPath = audioPath.replace(/\.mp3$/, '.aiff');
  try {
    await commandRunner('say', ['-v', 'Samantha', '-r', '178', '-o', aiffPath, text], { timeout: 60_000 });
    await commandRunner('ffmpeg', ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '4', audioPath], { timeout: 60_000 });
  } catch {
    await commandRunner('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3.2', '-codec:a', 'libmp3lame', audioPath], { timeout: 60_000 });
  }
  const duration = await probeDurationMs(audioPath, commandRunner);
  return Math.max(1600, Math.ceil(duration));
}

async function probeDurationMs(filePath, commandRunner) {
  try {
    const { stdout } = await commandRunner('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath], { timeout: 30_000 });
    return Number(stdout.trim()) * 1000;
  } catch {
    return 3200;
  }
}

function timedCaptions(text, sceneStartMs, durationMs) {
  const words = concise(text).split(/\s+/).filter(Boolean).slice(0, 18);
  const step = durationMs / Math.max(words.length, 1);
  return words.map((word, index) => ({
    text: index === 0 ? word : ` ${word}`,
    startMs: sceneStartMs + Math.floor(index * step),
    endMs: sceneStartMs + Math.floor((index + 1) * step),
  }));
}

function proofCaption(body) {
  const lines = String(body).split('\n').map((line) => line.replace(/^(script|shot list|captions|asset prompts|edit notes):\s*/i, '').trim()).filter(Boolean);
  return lines.find((line) => /proof|product|show|result|answer|generated|before|after/i.test(line)) ?? lines[0] ?? 'Show the product doing the work.';
}

function reelStyle() {
  return {
    highlightColor: '#7dd3fc',
    captionMaxFontSize: 96,
    combineMs: 900,
    captionPosition: 'bottom',
    strokeWidth: 12,
    strokeColor: 'black',
  };
}

function concise(text) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > 155 ? `${value.slice(0, 152).trimEnd()}...` : value;
}

function stableSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
}

async function defaultCommandRunner(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: options.cwd,
    timeout: options.timeout,
    maxBuffer: 1024 * 1024 * 20,
  });
}

function remotionRenderArgs(slug, outPath) {
  const args = ['remotion', 'render', 'src/index.ts', slug, outPath, '--overwrite', '--concurrency', '1', '--port', '3766'];
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE
    ?? process.env.CHROME_PATH
    ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (browserExecutable) args.push('--browser-executable', browserExecutable);
  return args;
}

function formatError(error) {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.message;
  return String(error);
}

const noopLogger = { warn: () => {}, info: () => {}, error: () => {} };

export { ProductProofCapture };
