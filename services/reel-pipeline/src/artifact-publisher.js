import { execFile } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function publishRenderArtifacts(renderResult, options = {}) {
  if (options.r2Bucket || process.env.REEL_ARTIFACT_R2_BUCKET) {
    return publishRenderArtifactsToR2(renderResult, options);
  }

  const baseUrl = options.baseUrl ?? process.env.REEL_ARTIFACT_BASE_URL;
  const publicDir = options.publicDir ?? process.env.REEL_ARTIFACT_PUBLIC_DIR;
  if (!baseUrl || !publicDir) return renderResult;

  return {
    ...renderResult,
    videos: await publishUrls(renderResult.videos ?? [], { baseUrl, publicDir }),
    combinedVideos: await publishUrls(renderResult.combinedVideos ?? [], { baseUrl, publicDir }),
  };
}

export async function publishRenderArtifactsToR2(renderResult, options = {}) {
  const bucket = options.r2Bucket ?? process.env.REEL_ARTIFACT_R2_BUCKET;
  const baseUrl = options.baseUrl ?? process.env.REEL_ARTIFACT_BASE_URL;
  if (!bucket || !baseUrl) return renderResult;

  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  return {
    ...renderResult,
    videos: await publishR2Urls(renderResult.videos ?? [], { bucket, baseUrl, commandRunner }),
    combinedVideos: await publishR2Urls(renderResult.combinedVideos ?? [], { bucket, baseUrl, commandRunner }),
  };
}

async function publishUrls(urls, options) {
  const published = [];
  for (const url of urls) {
    published.push(await publishUrl(url, options));
  }
  return published;
}

async function publishUrl(url, { baseUrl, publicDir }) {
  const localPath = await toLocalPath(url);
  if (!localPath) return url;
  await mkdir(publicDir, { recursive: true });
  const fileName = stableFileName(localPath);
  await copyFile(localPath, path.join(publicDir, fileName));
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(fileName)}`;
}

async function publishR2Urls(urls, options) {
  const published = [];
  for (const url of urls) {
    published.push(await publishR2Url(url, options));
  }
  return published;
}

async function publishR2Url(url, { bucket, baseUrl, commandRunner }) {
  const localPath = await toLocalPath(url);
  if (!localPath) return url;
  const key = stableFileName(localPath);
  await commandRunner('npx', [
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--file',
    localPath,
    '--remote',
    '--content-type',
    contentTypeFor(localPath),
  ]);
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
}

async function toLocalPath(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  if (url.startsWith('file://')) return new URL(url).pathname;
  if (url.startsWith('http://') || url.startsWith('https://')) return downloadLocalHttpArtifact(url);
  if (path.isAbsolute(url)) return url;
  return path.resolve(url);
}

async function downloadLocalHttpArtifact(url) {
  const parsed = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch local artifact ${url}: ${res.status}`);
  const fileName = path.basename(parsed.pathname);
  const taskId = path.basename(path.dirname(parsed.pathname));
  const dir = path.resolve('./tmp/downloaded-artifacts', taskId);
  await mkdir(dir, { recursive: true });
  const localPath = path.join(dir, fileName);
  await writeFile(localPath, Buffer.from(await res.arrayBuffer()));
  return localPath;
}

function stableFileName(localPath) {
  const parent = path.basename(path.dirname(localPath));
  const file = path.basename(localPath);
  return `${parent}-${file}`;
}

function contentTypeFor(localPath) {
  if (localPath.endsWith('.mp4')) return 'video/mp4';
  if (localPath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (localPath.endsWith('.webm')) return 'video/webm';
  if (localPath.endsWith('.png')) return 'image/png';
  if (localPath.endsWith('.jpg') || localPath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function defaultCommandRunner(command, args) {
  await execFileAsync(command, args);
}
