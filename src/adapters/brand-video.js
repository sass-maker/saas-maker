import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { contentPackageToVideoBrief, normalizeContentPackage } from '../content-package.js';
import { createFfmpegRunner } from '../composer/ffmpeg.js';
import { KokoroTts, isKokoroReady } from './kokoro.js';

export async function renderBrandContentPackage(input, options = {}) {
  const contentPackage = normalizeContentPackage(input);
  const brief = contentPackageToVideoBrief(contentPackage, { variantId: options.variantId, renderMode: 'brand-video' });
  const variant = contentPackage.variants.find((entry) => entry.id === (options.variantId ?? contentPackage.variants[0].id));
  if (!isKokoroReady() && !options.tts) throw new Error('kokoro is not installed — run `npm run setup:kokoro` first');

  const taskId = `${safeSlug(contentPackage.id)}-r${contentPackage.revision}-${safeSlug(variant.id)}`;
  const workDir = path.resolve(options.artifactDir ?? './artifacts/brand-video', taskId);
  const frameDir = path.join(workDir, 'frames');
  const audioDir = path.join(workDir, 'audio');
  const sceneDir = path.join(workDir, 'scenes');
  await Promise.all([mkdir(frameDir, { recursive: true }), mkdir(audioDir, { recursive: true }), mkdir(sceneDir, { recursive: true })]);

  const scenes = buildBrandScenes(contentPackage, variant);
  const sourceImagePath = path.join(workDir, 'source.png');
  const hasSourceImage = await captureSourcePage(contentPackage.source.canonicalUrl, sourceImagePath, options);
  const tts = options.tts ?? new KokoroTts({ voice: options.voice });
  const sceneAudio = await tts.synthesizeScenes(scenes, { outputDir: audioDir, voice: options.voice });
  const { runFfmpeg, probeDurationSeconds } = createFfmpegRunner(options);
  const sceneFiles = [];
  const sceneDurations = [];

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const number = String(index + 1).padStart(2, '0');
    const htmlPath = path.join(frameDir, `scene-${number}.html`);
    const imagePath = path.join(frameDir, `scene-${number}.png`);
    const videoPath = path.join(sceneDir, `scene-${number}.mp4`);
    await writeFile(htmlPath, renderSceneHtml(contentPackage, scene, index, scenes.length, hasSourceImage ? sourceImagePath : null));
    await captureFrame(htmlPath, imagePath, options);
    const duration = Math.max(2.8, await probeDurationSeconds(sceneAudio[index].path));
    await renderMotionScene({ imagePath, audioPath: sceneAudio[index].path, outputPath: videoPath, duration, runFfmpeg, index });
    sceneFiles.push(videoPath);
    sceneDurations.push(duration);
  }

  const concatPath = path.join(workDir, 'concat.txt');
  await writeFile(concatPath, sceneFiles.map((file) => `file '${escapeConcat(file)}'`).join('\n'));
  const outputPath = path.join(workDir, `${safeSlug(contentPackage.id)}.mp4`);
  await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', '-movflags', '+faststart', outputPath]);

  const receipt = {
    schema: 'fleet.media-receipt.v1',
    packageId: contentPackage.id,
    packageRevision: contentPackage.revision,
    variantId: variant.id,
    brand: contentPackage.brand.slug,
    channel: variant.channel,
    provider: 'brand-video-local',
    status: 'rendered',
    artifact: outputPath,
    durationSeconds: Number(sceneDurations.reduce((sum, value) => sum + value, 0).toFixed(3)),
    sourceUrl: contentPackage.source.canonicalUrl,
    renderedAt: new Date().toISOString(),
  };
  await writeFile(path.join(workDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  await writeFile(path.join(workDir, 'package.json'), `${JSON.stringify(contentPackage, null, 2)}\n`);
  await writeFile(path.join(workDir, 'brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  await writeFile(path.join(workDir, 'review.html'), renderReviewHtml(contentPackage, receipt));
  return { workDir, outputPath, receipt, reviewPath: path.join(workDir, 'review.html'), scenes };
}

export function buildBrandScenes(contentPackage, variant) {
  const claim = contentPackage.topic.claims[0];
  const sourceHost = new URL(contentPackage.source.canonicalUrl).hostname.replace(/^www\./, '');
  return [
    { kind: 'Hook', title: variant.hook, caption: contentPackage.topic.title, narration: variant.hook },
    { kind: 'Context', title: contentPackage.topic.summary, caption: 'Why this matters', narration: contentPackage.topic.summary },
    { kind: 'Evidence', title: claim.text, caption: `Source: ${sourceHost}`, narration: `Here is the evidence. ${claim.text}` },
    { kind: 'Takeaway', title: `The practical next move: ${variant.cta}`, caption: contentPackage.brand.name, narration: `The practical next move is simple. ${variant.cta}` },
    { kind: 'Next', title: variant.cta, caption: new URL(contentPackage.topic.destinationUrl).hostname, narration: variant.cta },
  ];
}

async function captureFrame(htmlPath, imagePath, options) {
  const runner = options.chromeRunner ?? defaultChromeRunner;
  await runner(htmlPath, imagePath);
  const bytes = await readFile(imagePath);
  if (bytes.length < 10_000) throw new Error(`Chrome produced an invalid scene frame: ${imagePath}`);
}

async function captureSourcePage(url, imagePath, options) {
  if (options.captureSource === false) return false;
  try {
    await captureBrowserPage(url, imagePath, { waitUntil: 'networkidle' });
    return (await readFile(imagePath)).length >= 10_000;
  } catch {
    return false;
  }
}

async function defaultChromeRunner(htmlPath, imagePath) {
  await captureBrowserPage(pathToFileURL(htmlPath).href, imagePath, { waitUntil: 'load' });
}

async function captureBrowserPage(url, imagePath, options) {
  const browser = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: options.waitUntil, timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: imagePath, type: 'png', animations: 'disabled' });
  } finally {
    await browser.close();
  }
}

async function renderMotionScene({ imagePath, audioPath, outputPath, duration, runFfmpeg, index }) {
  const fadeOut = Math.max(0, duration - 0.18).toFixed(3);
  const zoom = index % 2 === 0 ? "min(zoom+0.00035,1.035)" : "if(eq(on,1),1.035,max(zoom-0.0003,1.0))";
  await runFfmpeg([
    '-y', '-loop', '1', '-framerate', '30', '-i', imagePath, '-i', audioPath, '-t', duration.toFixed(3),
    '-vf', `scale=1080:1920,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,fade=t=in:st=0:d=0.18,fade=t=out:st=${fadeOut}:d=0.18,format=yuv420p`,
    '-af', `afade=t=in:st=0:d=0.08,afade=t=out:st=${Math.max(0, duration - 0.12).toFixed(3)}:d=0.12`,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', outputPath,
  ]);
}

function renderSceneHtml(contentPackage, scene, index, total, sourceImagePath) {
  const palette = contentPackage.brand.palette;
  const hasVisual = scene.kind === 'Evidence' && sourceImagePath;
  const titleSize = hasVisual ? 57 : scene.title.length > 190 ? 54 : scene.title.length > 115 ? 66 : scene.title.length > 65 ? 78 : 92;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:${palette.background};color:${palette.foreground};font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}
    main{position:relative;width:1080px;height:1920px;padding:92px 82px 84px;display:flex;flex-direction:column;border-top:18px solid ${palette.accent}}
    header{display:flex;align-items:center;justify-content:space-between;padding-bottom:38px;border-bottom:2px solid ${palette.foreground}33;font-size:25px;font-weight:750}
    .brand{color:${palette.accent}}.count{color:${palette.foreground}99;font-variant-numeric:tabular-nums}
    .content{flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px}.content.visual{display:grid;grid-template-rows:auto auto auto minmax(520px,760px);align-content:center}.kind{color:${palette.secondary};font-size:25px;font-weight:850;text-transform:uppercase}
    h1{margin:0;font-size:${titleSize}px;line-height:1.02;font-weight:800;overflow-wrap:anywhere}.rule{width:150px;height:10px;background:${palette.accent}}
    .proof{width:100%;height:100%;min-height:520px;object-fit:cover;object-position:top;border:2px solid ${palette.foreground}33;background:#000}
    footer{display:grid;grid-template-columns:1fr auto;gap:28px;align-items:end;padding-top:36px;border-top:2px solid ${palette.foreground}33}.caption{font-size:31px;line-height:1.25;color:${palette.foreground}B8}.source{font-size:23px;color:${palette.accent};text-align:right}
  </style></head><body><main><header><span class="brand">${escapeHtml(contentPackage.brand.name)}</span><span class="count">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></header><section class="content${hasVisual ? ' visual' : ''}"><div class="kind">${escapeHtml(scene.kind)}</div><div class="rule"></div><h1>${escapeHtml(scene.title)}</h1>${hasVisual ? `<img class="proof" src="file://${escapeHtml(sourceImagePath)}" alt="Source evidence">` : ''}</section><footer><div class="caption">${escapeHtml(scene.caption)}</div><div class="source">${escapeHtml(new URL(contentPackage.source.canonicalUrl).hostname.replace(/^www\./, ''))}</div></footer></main></body></html>`;
}

function renderReviewHtml(contentPackage, receipt) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Review ${escapeHtml(contentPackage.topic.title)}</title><style>body{margin:0;background:#090b0c;color:#f5f7f6;font:16px/1.5 Inter,system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:28px;display:grid;grid-template-columns:minmax(260px,420px) 1fr;gap:34px}video{width:100%;aspect-ratio:9/16;background:#000}h1{font-size:32px;line-height:1.08}a{color:#76d7c4}.meta{padding-block:14px;border-top:1px solid #ffffff20}code{overflow-wrap:anywhere}@media(max-width:760px){main{grid-template-columns:1fr;padding:16px}h1{font-size:25px}}</style></head><body><main><video controls src="${escapeHtml(path.basename(receipt.artifact))}"></video><section><p>${escapeHtml(contentPackage.brand.name)} · ${escapeHtml(receipt.channel)}</p><h1>${escapeHtml(contentPackage.topic.title)}</h1><div class="meta"><strong>Approval</strong><br>${escapeHtml(contentPackage.approval.status)} · revision ${contentPackage.revision}</div><div class="meta"><strong>Source</strong><br><a href="${escapeHtml(contentPackage.source.canonicalUrl)}">${escapeHtml(contentPackage.source.canonicalUrl)}</a></div><div class="meta"><strong>Package</strong><br><code>${escapeHtml(contentPackage.id)}</code></div><div class="meta"><strong>Duration</strong><br>${receipt.durationSeconds}s</div><p>This is a local review artifact. Publishing requires a separate approved distribution receipt.</p></section></main></body></html>`;
}

function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function escapeConcat(value) { return String(value).replaceAll("'", "'\\''"); }
function safeSlug(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140); }
