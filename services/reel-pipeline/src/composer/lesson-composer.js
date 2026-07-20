import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createFfmpegRunner } from './ffmpeg.js';
import { buildSrtFromScenes } from './captions.js';

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const TARGET_FPS = 30;

export async function composeLesson({
  script,
  sceneAudio,
  sceneClips,
  workDir,
  outputPath,
  options = {},
}) {
  if (!script || !Array.isArray(script.scenes) || !script.scenes.length) {
    throw new Error('composeLesson: script.scenes required');
  }
  if (!Array.isArray(sceneAudio) || sceneAudio.length !== script.scenes.length) {
    throw new Error('composeLesson: sceneAudio length must match script.scenes');
  }
  if (!Array.isArray(sceneClips) || sceneClips.length !== script.scenes.length) {
    throw new Error('composeLesson: sceneClips length must match script.scenes');
  }
  if (!workDir) throw new Error('composeLesson: workDir required');
  if (!outputPath) throw new Error('composeLesson: outputPath required');

  await mkdir(workDir, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });

  const { runFfmpeg, probeDurationSeconds } = createFfmpegRunner(options);

  const sceneDurations = [];
  const sceneFiles = [];

  for (let index = 0; index < script.scenes.length; index += 1) {
    const scene = script.scenes[index];
    const audio = sceneAudio[index];
    const clip = sceneClips[index];
    if (!audio?.path) throw new Error(`scene ${index + 1} missing audio path`);
    if (!clip?.path) throw new Error(`scene ${index + 1} missing video clip`);

    const audioDuration = await probeDurationSeconds(audio.path);
    const clipDuration = await probeDurationSeconds(clip.path);
    sceneDurations.push(audioDuration);

    const sceneOut = path.join(workDir, `scene-${String(index + 1).padStart(2, '0')}.mp4`);
    await renderScene({
      videoPath: clip.path,
      audioPath: audio.path,
      targetDuration: audioDuration,
      sourceDuration: clipDuration,
      onScreenText: scene.onScreenText,
      outputPath: sceneOut,
      runFfmpeg,
    });
    sceneFiles.push(sceneOut);
  }

  const concatListPath = path.join(workDir, 'concat.txt');
  const concatBody = sceneFiles.map((file) => `file '${escapeForConcat(file)}'`).join('\n');
  await writeFile(concatListPath, concatBody);

  const srt = buildSrtFromScenes(script.scenes, sceneDurations);
  const srtPath = path.join(workDir, 'captions.srt');
  await writeFile(srtPath, srt, 'utf8');

  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-vf', subtitlesFilter(srtPath),
    '-r', String(TARGET_FPS),
    '-c:v', 'libx264',
    '-preset', options.preset ?? 'medium',
    '-crf', String(options.crf ?? 20),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    outputPath,
  ]);

  if (!options.keepWork) {
    await Promise.allSettled(sceneFiles.map((file) => rm(file, { force: true })));
    await rm(concatListPath, { force: true });
  }

  return {
    outputPath,
    durationSeconds: sceneDurations.reduce((sum, value) => sum + value, 0),
    sceneDurations,
    srtPath,
  };
}

async function renderScene({ videoPath, audioPath, targetDuration, sourceDuration, onScreenText, outputPath, runFfmpeg }) {
  const args = ['-y'];

  if (sourceDuration && sourceDuration < targetDuration) {
    args.push('-stream_loop', '-1');
  }
  args.push('-i', videoPath);
  args.push('-i', audioPath);

  const videoFilter = [
    `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
    `setsar=1`,
    `fps=${TARGET_FPS}`,
  ];
  if (onScreenText && onScreenText.trim()) {
    videoFilter.push(buildDrawTextFilter(onScreenText.trim()));
  }

  args.push(
    '-t', String(targetDuration.toFixed(3)),
    '-vf', videoFilter.join(','),
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    outputPath,
  );

  await runFfmpeg(args);
}

function buildDrawTextFilter(text) {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\\\'")
    .replace(/%/g, '\\\\%');
  return [
    `drawtext=text='${escaped}'`,
    `fontsize=72`,
    `fontcolor=white`,
    `borderw=4`,
    `bordercolor=black`,
    `x=(w-text_w)/2`,
    `y=h*0.18`,
  ].join(':');
}

function subtitlesFilter(srtPath) {
  const escaped = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\\\'");
  const style = [
    'Fontname=Helvetica',
    'Fontsize=18',
    'PrimaryColour=&H00FFFFFF',
    'OutlineColour=&H00000000',
    'BorderStyle=3',
    'Outline=2',
    'Shadow=0',
    'Alignment=2',
    'MarginV=160',
  ].join(',');
  return `subtitles='${escaped}':force_style='${style}'`;
}

function escapeForConcat(filePath) {
  return filePath.replace(/'/g, "'\\''");
}
