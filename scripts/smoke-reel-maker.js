import { createDraftVideo } from '../src/pipeline.js';

const result = await createDraftVideo({
  id: `reelmaker-smoke-${Date.now()}`,
  projectSlug: 'linkchat',
  channel: 'tiktok',
  title: 'Your profile can answer first',
  hook: 'Stop answering the same profile question manually.',
  body: [
    'Script: Show a creator opening the same DM again, then show Linkchat answering it from their profile.',
    'Shot list: repeated question, AI profile answer, creator free to do real work.',
    'Captions: same question again / answer it once / send one smart link.',
    'Asset prompts: vertical phone UI, profile page, clean chat answer, realistic creator desk.',
  ].join('\n'),
  cta: 'Ask the profile one question.',
  renderMode: 'remotion',
}, {
  mode: 'remotion',
  artifacts: {
    baseUrl: process.env.REEL_ARTIFACT_BASE_URL,
    r2Bucket: process.env.REEL_ARTIFACT_R2_BUCKET,
    publicDir: process.env.REEL_ARTIFACT_PUBLIC_DIR,
  },
});

console.log(JSON.stringify({
  ok: true,
  status: result.status,
  provider: result.render.provider,
  video: result.render.videos?.[0],
  jobId: result.id,
  raw: result.render.raw,
}, null, 2));
