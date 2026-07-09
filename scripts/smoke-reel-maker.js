import { ProductProofCapture, loadPlaywrightFactory } from '../src/product-proof-capture.js';
import { renderReelVariants } from '../src/pipeline.js';
import { normalizeVideoBrief } from '../src/video-brief.js';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const REPORT_PATH = process.env.REEL_MAKER_SMOKE_REPORT ?? 'tmp/reel-maker-smoke/report.json';
const ROOT = process.env.REEL_MAKER_SMOKE_ROOT ?? 'tmp/reel-maker-smoke';
const PROOF_VIDEO = path.resolve(ROOT, 'proof', 'linkchat-demo-proof.mp4');

main().catch(async (error) => {
  const report = {
    schema: 'reel-pipeline.reel-maker-smoke.v1',
    ok: false,
    error: formatError(error),
    generatedAt: new Date().toISOString(),
  };
  await writeReport(report);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
});

async function main() {
  const recordingUrl = process.env.REEL_SMOKE_RECORDING_URL ?? await ensureProofVideo();
  const browserFactory = await loadPlaywrightFactory();
  const productProofCapture = new ProductProofCapture({
    outputDir: process.env.REEL_PROOF_DIR ?? './tmp/product-proof',
    browserFactory,
  });

  const brief = normalizeVideoBrief({
    id: `reelmaker-smoke-${Date.now()}`,
    projectSlug: process.env.REEL_SMOKE_PROJECT_SLUG ?? 'linkchat',
    channel: 'tiktok',
    title: process.env.REEL_SMOKE_TITLE ?? 'Your profile can answer first',
    hook: process.env.REEL_SMOKE_HOOK ?? 'Stop answering the same profile question manually.',
    body: [
      'Script: Show a creator opening the same DM again, then show the product answering it.',
      'Shot list: repeated question, AI profile answer, creator free to do real work.',
      'Captions: same question again / answer it once / send one smart link.',
      'Asset prompts: vertical phone UI, profile page, clean chat answer.',
    ].join('\n'),
    cta: process.env.REEL_SMOKE_CTA ?? 'Ask the profile one question.',
    productUrl: process.env.REEL_SMOKE_PRODUCT_URL,
    proofUrl: process.env.REEL_SMOKE_PROOF_URL,
    targetRoute: process.env.REEL_SMOKE_TARGET_ROUTE,
    recordingUrl,
    template: process.env.REEL_SMOKE_TEMPLATE ?? 'mini_demo',
    demoSteps: [
      { action: 'open', caption: 'Open the profile.' },
      { action: 'ask', caption: 'Ask one repeated question.' },
      { action: 'see', caption: 'See the answer appear.' },
    ],
    renderMode: 'remotion',
  });

  const variantCount = Math.max(1, Math.min(6, Number(process.env.REEL_SMOKE_VARIANT_COUNT ?? 3)));
  const { variants, renderLog } = await renderReelVariants(brief, {
    mode: 'remotion',
    variantCount,
    productProofCapture,
    reelMaker: {
      productProofCapture,
      skipRemotionRender: process.env.REEL_SMOKE_SKIP_REMOTION === '1',
    },
    artifacts: {
      baseUrl: process.env.REEL_ARTIFACT_BASE_URL,
      r2Bucket: process.env.REEL_ARTIFACT_R2_BUCKET,
      publicDir: process.env.REEL_ARTIFACT_PUBLIC_DIR,
    },
  });

  const report = {
    schema: 'reel-pipeline.reel-maker-smoke.v1',
    ok: variants.some((variant) => variant.status === 'video_ready' || variant.status === 'needs_review'),
    variantCount,
    hasBrowser: Boolean(browserFactory),
    variants: variants.map((variant) => ({
      variantId: variant.variantId,
      template: variant.template,
      proofType: variant.proofType,
      status: variant.status,
      qualityScore: variant.qualityScore,
      qualityReasons: variant.qualityReasons,
      assetUrl: variant.assetUrl,
    })),
    renderLog,
    proofVideo: recordingUrl,
    generatedAt: new Date().toISOString(),
  };

  await writeReport(report);
  console.log(JSON.stringify(report, null, 2));

  if (!report.ok) process.exit(1);
}

async function writeReport(report) {
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

async function ensureProofVideo() {
  await mkdir(path.dirname(PROOF_VIDEO), { recursive: true });
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc2=size=720x1280:rate=24',
    '-f', 'lavfi',
    '-i', 'sine=frequency=660:duration=3',
    '-t', '3',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    PROOF_VIDEO,
  ], { maxBuffer: 1024 * 1024 * 10 });
  return PROOF_VIDEO;
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
