import { ProductProofCapture, loadPlaywrightFactory } from '../src/product-proof-capture.js';
import { renderReelVariants } from '../src/pipeline.js';
import { normalizeVideoBrief } from '../src/video-brief.js';

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
  template: process.env.REEL_SMOKE_TEMPLATE,
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

console.log(JSON.stringify({
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
}, null, 2));
