import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DEFAULT_ENGINE_DIR = './engines/reel-maker';
const SCENE_COUNT = 3;

export class ReelMakerAdapter {
  constructor(options = {}) {
    this.engineDir = path.resolve(options.engineDir ?? process.env.REEL_MAKER_ENGINE_DIR ?? DEFAULT_ENGINE_DIR);
    this.commandRunner = options.commandRunner ?? defaultCommandRunner;
    this.now = options.now ?? (() => new Date());
  }

  async createVideo(brief) {
    const slug = stableSlug(`${brief.projectSlug}-${brief.id}`);
    const contentDir = path.join(this.engineDir, 'public', 'content', slug);
    const outPath = path.join(this.engineDir, 'out', `${slug}.mp4`);
    await mkdir(path.join(contentDir, 'images'), { recursive: true });
    await mkdir(path.join(contentDir, 'audio'), { recursive: true });
    await mkdir(path.dirname(outPath), { recursive: true });

    const scenes = splitBriefIntoScenes(brief);
    const timeline = { shortTitle: brief.title, elements: [], text: [], audio: [], style: reelStyle() };
    let offsetMs = 0;

    for (let index = 0; index < scenes.length; index += 1) {
      const uid = `scene-${index + 1}`;
      const imagePath = path.join(contentDir, 'images', `${uid}.png`);
      const audioPath = path.join(contentDir, 'audio', `${uid}.mp3`);
      await createSceneImage(imagePath, index, this.commandRunner);
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
    await writeFile(path.join(contentDir, 'descriptor.json'), `${JSON.stringify({ shortTitle: brief.title, content: scenes }, null, 2)}\n`);

    await this.commandRunner('bunx', remotionRenderArgs(slug, outPath), { cwd: this.engineDir, timeout: 300_000 });

    return {
      provider: 'reel-maker',
      externalTaskId: `reelmaker_${slug}_${this.now().getTime()}`,
      status: 'completed',
      videos: [outPath],
      raw: {
        slug,
        timelinePath: path.join(contentDir, 'timeline.json'),
      },
    };
  }
}

export function splitBriefIntoScenes(brief) {
  const cta = brief.cta ?? 'Try it on one real workflow.';
  return [
    {
      label: 'Pain',
      caption: brief.hook,
      voiceover: concise(brief.hook),
      visual: `Show the exact user pain for ${brief.projectSlug}.`,
    },
    {
      label: 'Proof',
      caption: proofCaption(brief.body),
      voiceover: concise(proofCaption(brief.body)),
      visual: 'Show the product moment, not generic AI visuals.',
    },
    {
      label: 'Action',
      caption: cta,
      voiceover: concise(cta),
      visual: 'End on a clear result and one simple next action.',
    },
  ].slice(0, SCENE_COUNT);
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

async function createSceneImage(imagePath, index, commandRunner) {
  const colors = [
    ['0x08111f', '0x22d3ee'],
    ['0x130b1f', '0xa78bfa'],
    ['0x101607', '0xbef264'],
  ][index % 3];
  const filter = [
    `color=c=${colors[0]}:s=1080x1920:d=1`,
    `drawbox=x=72:y=120:w=936:h=1680:color=${colors[1]}@0.18:t=fill`,
    `drawbox=x=72:y=120:w=936:h=1680:color=${colors[1]}@0.78:t=8`,
    'drawbox=x=132:y=240:w=816:h=420:color=white@0.08:t=fill',
    'drawbox=x=132:y=760:w=816:h=760:color=black@0.28:t=fill',
    'drawbox=x=192:y=1040:w=696:h=310:color=white@0.10:t=fill',
    `drawbox=x=232:y=1090:w=616:h=70:color=${colors[1]}@0.75:t=fill`,
    'drawbox=x=232:y=1200:w=420:h=34:color=white@0.25:t=fill',
    'drawbox=x=232:y=1270:w=520:h=34:color=white@0.18:t=fill',
  ].join(',');
  await commandRunner('ffmpeg', ['-y', '-f', 'lavfi', '-i', filter, '-frames:v', '1', imagePath], { timeout: 60_000 });
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
