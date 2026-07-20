import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://api.pexels.com';

export class PexelsClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.PEXELS_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.PEXELS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchVideos(query, options = {}) {
    if (!this.apiKey) throw new Error('PEXELS_API_KEY is required');
    const params = new URLSearchParams({
      query,
      orientation: options.orientation ?? 'portrait',
      size: options.size ?? 'medium',
      per_page: String(options.perPage ?? 10),
    });
    const res = await this.fetchImpl(`${this.baseUrl}/videos/search?${params}`, {
      headers: { authorization: this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`Pexels search failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    return (payload.videos ?? []).map((video) => ({
      id: video.id,
      durationSeconds: video.duration,
      width: video.width,
      height: video.height,
      previewImage: video.image,
      files: (video.video_files ?? []).map((file) => ({
        url: file.link,
        width: file.width,
        height: file.height,
        quality: file.quality,
        fileType: file.file_type,
      })),
      user: video.user?.name,
    }));
  }

  async downloadFile(url, destinationPath) {
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Pexels download failed ${res.status}: ${await res.text()}`);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, Buffer.from(await res.arrayBuffer()));
    return destinationPath;
  }
}

export function selectBestFile(video, { preferHeightAtLeast = 1280 } = {}) {
  const portrait = video.files.filter((file) => file.height >= file.width);
  const candidates = portrait.length ? portrait : video.files;
  const sorted = candidates
    .filter((file) => file.fileType === 'video/mp4' || !file.fileType)
    .sort((left, right) => {
      const leftScore = Math.abs((left.height ?? 0) - preferHeightAtLeast);
      const rightScore = Math.abs((right.height ?? 0) - preferHeightAtLeast);
      return leftScore - rightScore;
    });
  return sorted[0] ?? candidates[0] ?? null;
}

export async function fetchScenebRoll(scenes, options = {}) {
  const client = options.client ?? new PexelsClient(options);
  const outputDir = options.outputDir;
  if (!outputDir) throw new Error('outputDir is required');
  await mkdir(outputDir, { recursive: true });
  const usedVideoIds = new Set();

  const results = [];
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const query = scene.brollQuery?.trim() || scene.label || 'abstract motion';
    let chosen = null;
    let chosenFile = null;
    try {
      const videos = await client.searchVideos(query, options);
      const ranked = videos
        .filter((video) => !usedVideoIds.has(video.id))
        .filter((video) => video.durationSeconds >= scene.durationSeconds - 2);
      const pool = ranked.length ? ranked : videos.filter((video) => !usedVideoIds.has(video.id));
      chosen = pool[0] ?? videos[0] ?? null;
      chosenFile = chosen ? selectBestFile(chosen) : null;
    } catch (error) {
      results.push({ sceneIndex: index, error: error.message, path: null });
      continue;
    }
    if (!chosen || !chosenFile) {
      results.push({ sceneIndex: index, error: 'no clip found', path: null });
      continue;
    }
    usedVideoIds.add(chosen.id);
    const destination = path.join(outputDir, `scene-${String(index + 1).padStart(2, '0')}.mp4`);
    await client.downloadFile(chosenFile.url, destination);
    results.push({
      sceneIndex: index,
      query,
      path: destination,
      videoId: chosen.id,
      sourceDurationSeconds: chosen.durationSeconds,
      sourceWidth: chosenFile.width,
      sourceHeight: chosenFile.height,
      sourceUser: chosen.user,
    });
  }
  return results;
}
