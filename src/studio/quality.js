import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const WEAK_OPENERS = ['in this video', 'hello everyone', 'welcome back', 'today we', "today i'm", 'hey guys'];
const PACING_MIN_WPS = 2.0;
const PACING_MAX_WPS = 3.2;

export async function probeVideo(videoPath, { ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe' } = {}) {
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_streams',
      '-show_format',
      '-of', 'json',
      videoPath,
    ], { timeout: 30_000 });
    const payload = JSON.parse(stdout);
    const video = (payload.streams ?? []).find((s) => s.codec_type === 'video');
    const audio = (payload.streams ?? []).find((s) => s.codec_type === 'audio');
    if (!video) return { ok: false, reason: 'no video stream' };
    return {
      ok: true,
      durationSeconds: Number(payload.format?.duration ?? video.duration ?? 0),
      width: Number(video.width ?? 0),
      height: Number(video.height ?? 0),
      hasAudio: Boolean(audio),
    };
  } catch (error) {
    return { ok: false, reason: error.message?.slice(0, 200) ?? 'probe failed' };
  }
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreRender({ script, probe }) {
  const dimensions = {};

  const narrations = (script?.scenes ?? []).map((scene) => scene.narration ?? '');
  const totalWords = narrations.join(' ').split(/\s+/).filter(Boolean).length;
  const target = Number(script?.targetDurationSeconds ?? 0);

  // Script heuristics — always available.
  const hookWords = (narrations[0] ?? '').split(/\s+/).filter(Boolean).length;
  const hookLower = (script?.hook ?? narrations[0] ?? '').toLowerCase();
  let hookScore = hookWords > 0 && hookWords <= 14 ? 100 : hookWords <= 20 ? 70 : 40;
  if (WEAK_OPENERS.some((opener) => hookLower.startsWith(opener))) hookScore = Math.min(hookScore, 30);
  dimensions.hookStrength = clampScore(hookScore);

  const captioned = (script?.scenes ?? []).filter((scene) => scene.onScreenText).length;
  const sceneCount = Math.max(1, (script?.scenes ?? []).length);
  // Burned subtitles cover every scene in our compose paths; onScreenText is extra signal.
  dimensions.captionCoverage = clampScore(60 + (captioned / sceneCount) * 40);

  const effectiveDuration = probe?.ok ? probe.durationSeconds : target;
  if (effectiveDuration > 0 && totalWords > 0) {
    const wps = totalWords / effectiveDuration;
    dimensions.pacing = clampScore(
      wps >= PACING_MIN_WPS && wps <= PACING_MAX_WPS
        ? 100
        : 100 - Math.min(60, Math.abs(wps - (wps < PACING_MIN_WPS ? PACING_MIN_WPS : PACING_MAX_WPS)) * 60),
    );
  }

  // Video evidence — only when the probe worked.
  if (probe?.ok) {
    if (target > 0) {
      const drift = Math.abs(probe.durationSeconds - target) / target;
      dimensions.durationFit = clampScore(100 - drift * 200);
    }
    dimensions.resolution = probe.width >= 1080 && probe.height >= 1920 ? 100 : probe.height > probe.width ? 60 : 20;
    dimensions.audioPresence = probe.hasAudio ? 100 : 0;
  }

  const values = Object.values(dimensions);
  const overall = values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : 0;
  const verdict = overall >= 70 ? 'pass' : overall >= 50 ? 'review' : 'fail';

  return {
    overall,
    verdict,
    dimensions,
    videoEvidence: Boolean(probe?.ok),
    probeReason: probe?.ok ? undefined : probe?.reason,
  };
}

export async function assessRender({ script, videoPath, prober = probeVideo, ffprobePath } = {}) {
  const probe = videoPath ? await prober(videoPath, { ffprobePath }) : { ok: false, reason: 'no video path' };
  return scoreRender({ script, probe });
}
