import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = process.cwd();
const baseUrl = (process.env.MONEYPRINTER_API_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
const engineRoot = path.join(repoRoot, 'engines', 'MoneyPrinterTurbo');
const localVideosDir = path.join(engineRoot, 'storage', 'local_videos');
const canaryDir = path.join(engineRoot, 'storage', 'canary');
const resultDir = path.join(repoRoot, 'tmp');
const videoPath = path.join(localVideosDir, 'reel-pipeline-canary.mp4');
const audioPath = path.join(canaryDir, 'reel-pipeline-canary-audio.mp3');
const resultPath = path.join(resultDir, 'moneyprinter-canary-result.json');

main().catch(async (error) => {
  const summary = {
    schema: 'reel-pipeline.moneyprinter-canary.v1',
    ok: false,
    baseUrl,
    inputVideo: videoPath,
    inputAudio: audioPath,
    error: formatError(error),
    checkedAt: new Date().toISOString(),
  };
  await mkdir(resultDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.error(JSON.stringify(summary, null, 2));
  process.exit(1);
});

async function main() {
  await mkdir(localVideosDir, { recursive: true });
  await mkdir(canaryDir, { recursive: true });
  await mkdir(resultDir, { recursive: true });

  await ensureCanaryVideo();
  await ensureCanaryAudio();
  await assertServerReady();

  const createPayload = {
    video_subject: 'Reel Pipeline Canary',
    video_script: 'This is a local render canary for reel pipeline. It uses local video and local audio. No external APIs are required.',
    video_aspect: '9:16',
    video_concat_mode: 'sequential',
    video_transition_mode: null,
    video_clip_duration: 4,
    video_count: 1,
    video_source: 'local',
    video_materials: [
      {
        provider: 'local',
        url: videoPath,
        duration: 8,
      },
    ],
    custom_audio_file: audioPath,
    voice_name: 'en-US-AriaNeural-Female',
    voice_rate: 1,
    bgm_type: 'none',
    bgm_volume: 0,
    subtitle_enabled: false,
    n_threads: 2,
  };

  const createResponse = await postJson(`${baseUrl}/api/v1/videos`, createPayload);
  const taskId = createResponse?.data?.task_id;
  if (!taskId) {
    throw new Error(`MoneyPrinterTurbo did not return data.task_id: ${JSON.stringify(createResponse)}`);
  }

  const finalStatus = await pollTask(taskId);
  const videoOutput = firstVideoOutput(finalStatus);
  const localOutput = await resolveOutputToLocalPath(taskId, videoOutput);
  const outputStat = await stat(localOutput);

  if (outputStat.size < 1024) {
    throw new Error(`MoneyPrinterTurbo output is too small to be a valid MP4: ${localOutput}`);
  }

  const summary = {
    schema: 'reel-pipeline.moneyprinter-canary.v1',
    ok: true,
    taskId,
    baseUrl,
    inputVideo: videoPath,
    inputAudio: audioPath,
    output: localOutput,
    outputSize: outputStat.size,
    status: finalStatus?.data ?? finalStatus,
    checkedAt: new Date().toISOString(),
  };

  await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

async function ensureCanaryVideo() {
  if (await exists(videoPath)) return;
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc2=size=1080x1920:rate=30',
    '-t', '8',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    videoPath,
  ]);
}

async function ensureCanaryAudio() {
  if (await exists(audioPath)) return;
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=8',
    '-q:a', '4',
    audioPath,
  ]);
}

async function assertServerReady() {
  const docs = await probe(`${baseUrl}/docs`);
  const openapi = await probe(`${baseUrl}/openapi.json`);
  if (docs.ok || openapi.moneyPrinterOpenApi) return;
  throw new Error(
    [
      `MoneyPrinterTurbo server is not ready at ${baseUrl}`,
      `GET /docs -> ${docs.status}`,
      `GET /openapi.json -> ${openapi.status}`,
      'another service may be using this port; start MoneyPrinterTurbo on a free port and set MONEYPRINTER_API_URL',
    ].join('; '),
  );
}

async function probe(url) {
  try {
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') ?? '';
    let moneyPrinterOpenApi = false;
    if (contentType.includes('application/json')) {
      const body = await res.clone().json().catch(() => null);
      moneyPrinterOpenApi = body?.info?.title === 'MoneyPrinterTurbo';
    }
    return { ok: res.ok, status: res.status, moneyPrinterOpenApi };
  } catch (error) {
    return { ok: false, status: formatError(error), moneyPrinterOpenApi: false };
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function pollTask(taskId) {
  const deadline = Date.now() + Number(process.env.MONEYPRINTER_CANARY_TIMEOUT_MS ?? 240_000);
  let lastPayload = null;

  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/api/v1/tasks/${encodeURIComponent(taskId)}`);
    if (!res.ok) throw new Error(`task status failed ${res.status}: ${await res.text()}`);
    lastPayload = await res.json();
    const data = lastPayload?.data ?? {};
    const state = data.state;
    const progress = Number(data.progress ?? 0);

    if (state === -1 || state === 'failed') {
      throw new Error(`MoneyPrinterTurbo task failed: ${JSON.stringify(lastPayload)}`);
    }

    if (state === 1 || state === 'completed' || progress >= 100 || firstVideoOutput(lastPayload)) {
      return lastPayload;
    }

    console.log(`waiting for task ${taskId}: state=${state} progress=${progress}`);
    await sleep(2_000);
  }

  throw new Error(`Timed out waiting for MoneyPrinterTurbo task ${taskId}: ${JSON.stringify(lastPayload)}`);
}

function firstVideoOutput(payload) {
  const data = payload?.data ?? payload ?? {};
  return data.videos?.[0] ?? data.combined_videos?.[0];
}

async function resolveOutputToLocalPath(taskId, output) {
  if (!output) throw new Error(`MoneyPrinterTurbo completed without a video output for ${taskId}`);
  if (output.startsWith('/tasks/')) return path.join(engineRoot, 'storage', output.slice(1));
  if (output.startsWith('tasks/')) return path.join(engineRoot, 'storage', output);
  if (path.isAbsolute(output)) return output;
  return path.join(engineRoot, 'storage', 'tasks', taskId, output);
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
