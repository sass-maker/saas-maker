import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);

const ASPECT_TABLE = [
  ['9:16', 9 / 16],
  ['16:9', 16 / 9],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['4:3', 4 / 3],
];

async function defaultCommandRunner(command, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(command, args, { maxBuffer: 1024 * 1024 * 16, ...options });
  return { stdout: String(stdout), stderr: String(stderr) };
}

// Post-render self-review, stolen from OpenMontage: never trust the pipeline's
// own claimed metadata for the post gate — probe the file we actually rendered.
// Returns { probed, issues, ok } for a local video, or null when there is
// nothing local to probe / ffprobe is unavailable. Failure ALWAYS degrades to
// null (neutral) so URL-only, mock, and toolless environments are never gated
// to death by a missing probe.
export async function selfReviewRender(render, options = {}) {
  const filePath = localVideoPath(render);
  if (!filePath) return null;

  const fileExists = options.existsSync ?? existsSync;
  if (!fileExists(filePath)) return null;

  const commandRunner = options.commandRunner ?? defaultCommandRunner;
  const ffprobePath = options.ffprobePath ?? process.env.FFPROBE_PATH ?? 'ffprobe';

  let probe;
  try {
    const { stdout } = await commandRunner(ffprobePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ], { timeout: 30_000 });
    probe = JSON.parse(stdout);
  } catch {
    return null;
  }

  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const hasAudio = streams.some((stream) => stream.codec_type === 'audio');
  const width = Number(video?.width);
  const height = Number(video?.height);
  const duration = Number(probe?.format?.duration ?? video?.duration);

  const probed = {
    filePath,
    durationSeconds: Number.isFinite(duration) ? Math.round(duration * 10) / 10 : null,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    aspect: aspectFromDimensions(width, height),
    hasAudio,
  };

  const issues = [];
  if (!video) issues.push('rendered file has no video stream');
  if (!hasAudio) issues.push('rendered file has no audio track');
  if (probed.aspect && probed.aspect !== '9:16') issues.push(`rendered aspect ${probed.aspect} is not 9:16`);

  const claimed = Number(render?.durationSeconds ?? render?.raw?.durationSeconds);
  if (Number.isFinite(claimed) && Number.isFinite(duration) && Math.abs(claimed - duration) > 1) {
    issues.push(`claimed duration ${claimed}s but file is ${probed.durationSeconds}s`);
  }

  return { probed, issues, ok: issues.length === 0 };
}

function localVideoPath(render) {
  const candidates = [];
  if (Array.isArray(render?.videos)) candidates.push(...render.videos);
  if (Array.isArray(render?.combinedVideos)) candidates.push(...render.combinedVideos);
  if (typeof render?.videoUrl === 'string') candidates.push(render.videoUrl);
  return candidates.find((value) =>
    typeof value === 'string'
    && !/^https?:\/\//i.test(value)
    && /\.(mp4|mov|webm)$/i.test(value),
  ) ?? null;
}

function aspectFromDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !height) return null;
  const ratio = width / height;
  let best = null;
  for (const [label, value] of ASPECT_TABLE) {
    const delta = Math.abs(ratio - value);
    if (!best || delta < best.delta) best = { label, delta };
  }
  return best && best.delta <= 0.05 ? best.label : `${width}x${height}`;
}
