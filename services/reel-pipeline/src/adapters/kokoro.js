import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_KOKORO_DIR = path.join(REPO_ROOT, 'tools', 'kokoro');
const HELPER = path.join(REPO_ROOT, 'scripts', 'kokoro_tts.py');
export const DEFAULT_KOKORO_VOICE = 'af_heart';
const KOKORO_VOICE_PATTERN = /^[a-z]{2}_[a-z]+$/;

/** Kokoro voices look like af_heart / am_adam; anything else (e.g. an
 * Edge-TTS name passed by generic callers) falls back to the default. */
export function normalizeKokoroVoice(voice, fallback = process.env.KOKORO_VOICE ?? DEFAULT_KOKORO_VOICE) {
  if (typeof voice === 'string' && KOKORO_VOICE_PATTERN.test(voice.trim())) return voice.trim();
  return fallback;
}
const SYNTH_TIMEOUT_MS = 10 * 60 * 1000;

export function kokoroPaths(kokoroDir = process.env.KOKORO_DIR ?? DEFAULT_KOKORO_DIR) {
  return {
    dir: kokoroDir,
    python: path.join(kokoroDir, '.venv', 'bin', 'python'),
    model: path.join(kokoroDir, 'kokoro-v1.0.onnx'),
    voices: path.join(kokoroDir, 'voices-v1.0.bin'),
  };
}

export function isKokoroReady(kokoroDir) {
  const paths = kokoroPaths(kokoroDir);
  try {
    return [paths.python, paths.model, paths.voices].every((file) => existsSync(file));
  } catch {
    return false;
  }
}

export class KokoroTts {
  constructor(options = {}) {
    this.paths = kokoroPaths(options.kokoroDir);
    this.voice = normalizeKokoroVoice(options.voice);
    this.speed = Number(options.speed ?? process.env.KOKORO_SPEED ?? 1.0);
    this.lang = options.lang ?? 'en-us';
    this.runner = options.runner ?? ((payload) => this.spawnHelper(payload));
  }

  spawnHelper(payload) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.paths.python, [HELPER], {
        env: { ...process.env, KOKORO_DIR: this.paths.dir },
        timeout: SYNTH_TIMEOUT_MS,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`kokoro synth exited ${code}: ${stderr.slice(0, 300)}`));
          return;
        }
        resolve(stdout);
      });
      child.stdin.end(JSON.stringify(payload));
    });
  }

  async synthesizeScenes(scenes, options = {}) {
    if (!isKokoroReady(this.paths.dir) && !options.skipReadyCheck) {
      throw new Error('kokoro is not installed — run `npm run setup:kokoro` first');
    }
    const outputDir = options.outputDir;
    if (!outputDir) throw new Error('outputDir is required');
    await mkdir(outputDir, { recursive: true });

    const jobs = [];
    const results = scenes.map((scene, index) => {
      if (!scene.narration?.trim()) return { sceneIndex: index, path: null, byteLength: 0 };
      const filePath = path.join(outputDir, `scene-${String(index + 1).padStart(2, '0')}.wav`);
      jobs.push({ text: scene.narration.trim(), outPath: filePath });
      return { sceneIndex: index, path: filePath, byteLength: 0 };
    });

    if (jobs.length) {
      await this.runner({
        scenes: jobs,
        voice: normalizeKokoroVoice(options.voice, this.voice),
        speed: options.speed ?? this.speed,
        lang: options.lang ?? this.lang,
      });
      for (const entry of results) {
        if (entry.path) entry.byteLength = statSync(entry.path).size;
      }
    }
    return results;
  }
}

/** Drop-in replacement for the ElevenLabs adapter's synthesizeSceneAudio. */
export async function synthesizeSceneAudio(scenes, options = {}) {
  const tts = options.kokoro instanceof KokoroTts ? options.kokoro : new KokoroTts(options.kokoro ?? options);
  return tts.synthesizeScenes(scenes, options);
}
