import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const DEFAULT_ARTIFACT_DIR = './artifacts/grok-video';

export class GrokVideoAdapter {
  constructor(options = {}) {
    this.assetDir = options.assetDir ?? process.env.GROK_VIDEO_ASSET_DIR ?? null;
    this.artifactDir = options.artifactDir ?? process.env.REEL_GROK_VIDEO_ARTIFACT_DIR ?? DEFAULT_ARTIFACT_DIR;
    this.now = options.now ?? (() => new Date());
  }

  async createVideo(brief) {
    const source = await this.selectSourceVideo(brief);
    const taskId = `grok_${stableSlug(brief.id)}_${this.now().getTime()}`;
    const dir = path.resolve(this.artifactDir, taskId);
    await mkdir(dir, { recursive: true });

    const fileName = `${stableSlug(brief.projectSlug)}-${stableSlug(brief.id)}${path.extname(source) || '.mp4'}`;
    const videoPath = path.join(dir, fileName);
    await copyFile(source, videoPath);

    const sourceStat = await stat(source);
    const render = {
      provider: 'grok-video',
      externalTaskId: taskId,
      status: 'completed',
      videos: [videoPath],
      durationSeconds: null,
      proofType: 'recording',
      captionText: brief.hook,
      renderLog: [
        `source=${path.basename(source)}`,
        `bytes=${sourceStat.size}`,
      ],
      raw: {
        assetDir: this.assetDir ? path.resolve(this.assetDir) : null,
        sourcePath: source,
        manifestPath: path.join(dir, 'manifest.json'),
        aspect: '9:16',
      },
    };

    await writeFile(render.raw.manifestPath, `${JSON.stringify({ taskId, brief, render }, null, 2)}\n`);
    return render;
  }

  async getStatus(externalTaskId) {
    const manifestPath = path.resolve(this.artifactDir, externalTaskId, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    return manifest.render;
  }

  async selectSourceVideo(brief) {
    const explicit = localVideoPath(brief.recordingUrl);
    if (explicit) return explicit;

    const selected = await selectGrokVideoAsset(brief, { assetDir: this.assetDir });
    if (selected) return selected.path;
    throw new Error('grok-video renderer requires GROK_VIDEO_ASSET_DIR or options.grokVideo.assetDir with at least one .mp4');
  }
}

export async function selectGrokVideoAsset(brief, options = {}) {
  const explicit = localVideoPath(brief?.recordingUrl ?? brief?.recording_url);
  if (explicit) return { path: explicit, source: 'recordingUrl', score: Infinity };

  const videos = await listMp4s(options.assetDir ?? process.env.GROK_VIDEO_ASSET_DIR ?? null);
  if (videos.length === 0) return null;

  const text = [
    brief?.projectSlug ?? brief?.project_slug,
    brief?.title,
    brief?.hook,
    brief?.body,
    brief?.cta,
    brief?.audience,
    ...(Array.isArray(options.sceneHints) ? options.sceneHints : []),
  ].filter(Boolean).join(' ');
  const scored = videos
    .map((video) => ({ path: video, source: 'assetDir', score: matchScore(text, path.basename(video)) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  if (scored[0].score > 0) return scored[0];

  const idx = stableIndex(brief?.id ?? text, videos.length);
  return { ...scored[idx], source: 'assetDir:fallback' };
}

function localVideoPath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (value.startsWith('file://')) return new URL(value).pathname;
  if (path.isAbsolute(value) && /\.(mp4|mov|webm)$/i.test(value)) return value;
  return null;
}

async function listMp4s(root) {
  if (!root) return [];
  const absolute = path.resolve(root);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    throw new Error(`could not read grok video asset dir ${absolute}: ${error.message}`);
  }

  const videos = [];
  for (const entry of entries) {
    const fullPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      videos.push(...await listMp4s(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) {
      videos.push(fullPath);
    }
  }
  return videos.sort();
}

function matchScore(text, fileName) {
  const haystack = tokenize(text);
  const needle = tokenize(fileName);
  let score = 0;
  for (const token of needle) {
    if (haystack.has(token)) score += token.length;
  }
  return score;
}

function tokenize(value) {
  return new Set(String(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function stableIndex(value, length) {
  const digest = createHash('sha256').update(String(value)).digest();
  return digest.readUInt32BE(0) % length;
}

function stableSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'video';
}
