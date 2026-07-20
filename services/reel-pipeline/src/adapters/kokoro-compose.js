import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KokoroTts, isKokoroReady } from './kokoro.js';
import { fetchScenebRoll } from './pexels.js';
import { composeLesson } from '../composer/lesson-composer.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MPT_CONFIG = path.join(REPO_ROOT, 'engines', 'MoneyPrinterTurbo', 'config.toml');
const DEFAULT_ARTIFACT_DIR = './artifacts/kokoro';

/**
 * Resolve a Pexels API key: env first, then the local MoneyPrinterTurbo
 * config so the kokoro engine needs no new credentials. Never log the value.
 */
export function resolvePexelsKey({ configPath = MPT_CONFIG } = {}) {
  if (process.env.PEXELS_API_KEY?.trim()) return process.env.PEXELS_API_KEY.trim();
  try {
    const toml = readFileSync(configPath, 'utf8');
    const match = toml.match(/^\s*pexels_api_keys\s*=\s*\[\s*"([^"]+)"/m);
    if (match) return match[1];
  } catch {
    // fall through — caller raises the actionable error
  }
  return null;
}

let cachedFfmpegPath;

/**
 * Captions need ffmpeg's drawtext filter, which some Homebrew builds lack.
 * Resolve: FFMPEG_PATH env → system ffmpeg if it has drawtext → the static
 * imageio ffmpeg bundled in the MoneyPrinterTurbo venv.
 */
export function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH?.trim()) return process.env.FFMPEG_PATH.trim();
  if (cachedFfmpegPath) return cachedFfmpegPath;
  if (hasDrawtext('ffmpeg')) {
    cachedFfmpegPath = 'ffmpeg';
    return cachedFfmpegPath;
  }
  const bundled = globSync(
    path.join(REPO_ROOT, 'engines', 'MoneyPrinterTurbo', '.venv', 'lib', 'python*', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-*'),
  );
  if (bundled.length && hasDrawtext(bundled[0])) {
    cachedFfmpegPath = bundled[0];
    return cachedFfmpegPath;
  }
  cachedFfmpegPath = 'ffmpeg';
  return cachedFfmpegPath;
}

function hasDrawtext(binary) {
  try {
    const probe = spawnSync(binary, ['-hide_banner', '-filters'], { encoding: 'utf8', timeout: 15_000 });
    return probe.status === 0 && String(probe.stdout).includes('drawtext');
  } catch {
    return false;
  }
}

/**
 * Fully local faceless renderer: Kokoro narration + Pexels b-roll + FFmpeg
 * lesson compositor. Needs the studio script (scene narrations + broll
 * queries), passed at construction — the VideoBrief body alone is prose.
 */
export class KokoroComposeAdapter {
  constructor(options = {}) {
    this.script = options.script ?? null;
    this.artifactDir = options.artifactDir ?? process.env.REEL_KOKORO_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR;
    this.voice = options.voice;
    this.tts = options.tts ?? null;
    this.brollFetcher = options.fetchScenebRoll ?? fetchScenebRoll;
    this.composer = options.composeLesson ?? composeLesson;
    this.pexelsKey = options.pexelsApiKey ?? null;
    this.readyCheck = options.readyCheck ?? isKokoroReady;
  }

  async createVideo(brief) {
    const script = this.script;
    if (!script?.scenes?.length) {
      throw new Error('kokoro engine needs a studio script — run it through the faceless workflow (npm run faceless -- --engine kokoro)');
    }
    if (!this.tts && !this.readyCheck()) {
      throw new Error('kokoro is not installed — run `npm run setup:kokoro` first');
    }
    const pexelsKey = this.pexelsKey ?? resolvePexelsKey();
    if (!pexelsKey) {
      throw new Error('no Pexels key found — set PEXELS_API_KEY or configure engines/MoneyPrinterTurbo/config.toml');
    }

    const taskId = `kokoro_${brief.id}_${Date.now()}`;
    const workDir = path.resolve(this.artifactDir, taskId);
    await mkdir(workDir, { recursive: true });

    const tts = this.tts ?? new KokoroTts({ voice: this.voice });
    const sceneAudio = await tts.synthesizeScenes(script.scenes, {
      outputDir: path.join(workDir, 'audio'),
      voice: this.voice,
    });

    const sceneClips = await this.brollFetcher(script.scenes, {
      apiKey: pexelsKey,
      outputDir: path.join(workDir, 'broll'),
    });
    const missing = sceneClips.findIndex((entry) => !entry.path);
    if (missing !== -1) {
      throw new Error(`no b-roll for scene ${missing + 1} (query: "${script.scenes[missing].brollQuery}")`);
    }

    const outputPath = path.join(workDir, 'video.mp4');
    const compose = await this.composer({
      script,
      sceneAudio,
      sceneClips,
      workDir: path.join(workDir, 'compose'),
      outputPath,
      options: { ffmpegPath: resolveFfmpegPath() },
    });

    return {
      provider: 'kokoro',
      externalTaskId: taskId,
      status: 'completed',
      videos: [outputPath],
      raw: { compose, sceneCount: script.scenes.length },
    };
  }

  async getStatus(externalTaskId) {
    return { provider: 'kokoro', externalTaskId, status: 'completed' };
  }
}
