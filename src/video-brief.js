const CHANNELS = new Set([
  'tiktok',
  'instagram_reels',
  'youtube_shorts',
  'blog',
  'email',
  'producthunt',
  'x',
  'reddit',
  'other',
]);

const REEL_CHANNELS = new Set(['tiktok', 'instagram_reels', 'youtube_shorts']);

const PROOF_TYPES = new Set([
  'screenshot',
  'recording',
  'changelog',
  'before_after',
  'product_artifact',
  'cockpit',
  'generated_card',
]);

export function isReelChannel(channel) {
  return REEL_CHANNELS.has(channel);
}

export function normalizeVideoBrief(input) {
  const brief = {
    id: stringOrThrow(input.id, 'id'),
    projectSlug: stringOrThrow(input.projectSlug ?? input.project_slug, 'projectSlug'),
    taskId: optionalString(input.taskId ?? input.task_id),
    marketingPostId: optionalString(input.marketingPostId ?? input.marketing_post_id),
    channel: normalizeChannel(input.channel),
    title: stringOrThrow(input.title, 'title'),
    hook: stringOrThrow(input.hook, 'hook'),
    body: stringOrThrow(input.body, 'body'),
    cta: optionalString(input.cta),
    audience: optionalString(input.audience),
    productUrl: optionalString(input.productUrl ?? input.product_url),
    proofUrl: optionalString(input.proofUrl ?? input.proof_url),
    targetRoute: optionalString(input.targetRoute ?? input.target_route),
    recordingUrl: optionalString(input.recordingUrl ?? input.recording_url),
    changelogEntryId: optionalString(input.changelogEntryId ?? input.changelog_entry_id),
    brandTone: optionalString(input.brandTone ?? input.brand_tone),
    proofType: normalizeProofType(input.proofType ?? input.proof_type),
    template: optionalString(input.template),
    screenshots: normalizeScreenshots(input.screenshots),
    demoSteps: normalizeDemoSteps(input.demoSteps ?? input.demo_steps),
    renderMode: normalizeRenderMode(input.renderMode ?? input.render_mode),
    durationSeconds: normalizeDuration(input.durationSeconds ?? input.duration_seconds),
  };

  if (isReelChannel(brief.channel) && !looksLikeVideoBrief(brief.body)) {
    throw new Error('reel channel body must include script, shot list, captions, and asset prompts');
  }

  return brief;
}

function normalizeProofType(value) {
  const proof = optionalString(value);
  if (!proof) return undefined;
  if (!PROOF_TYPES.has(proof)) throw new Error(`unsupported proofType: ${proof}`);
  return proof;
}

function normalizeScreenshots(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error('screenshots must be an array');
  const list = value
    .map((entry) => optionalString(entry))
    .filter(Boolean);
  return list.length ? list : undefined;
}

function normalizeDemoSteps(value) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error('demoSteps must be an array');
  const steps = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const action = optionalString(entry.action) ?? optionalString(entry.type);
    if (!action) continue;
    const step = { action };
    const route = optionalString(entry.route ?? entry.path ?? entry.url);
    if (route) step.route = route;
    const selector = optionalString(entry.selector);
    if (selector) step.selector = selector;
    const value = optionalString(entry.value ?? entry.text);
    if (value) step.value = value;
    const caption = optionalString(entry.caption);
    if (caption) step.caption = caption;
    const waitMs = Number.isFinite(Number(entry.waitMs ?? entry.wait_ms))
      ? Math.max(0, Math.min(10_000, Number(entry.waitMs ?? entry.wait_ms)))
      : undefined;
    if (waitMs !== undefined) step.waitMs = waitMs;
    steps.push(step);
  }
  return steps.length ? steps : undefined;
}

export function briefFromMarketingPost(post) {
  return normalizeVideoBrief({
    id: `brief_${post.id}`,
    projectSlug: post.project_slug,
    taskId: post.task_id,
    marketingPostId: post.id,
    channel: post.channel,
    title: post.title,
    hook: post.hook ?? post.title,
    body: post.body,
    cta: post.cta,
    renderMode: 'stock',
  });
}

export function toMoneyPrinterRequest(brief) {
  return {
    video_subject: `${brief.projectSlug}: ${brief.title}`,
    video_script: buildNarrationScript(brief),
    video_terms: extractSearchTerms(brief),
    video_aspect: '9:16',
    video_concat_mode: 'random',
    video_transition_mode: 'FadeIn',
    video_clip_duration: 4,
    video_count: 1,
    video_source: 'pexels',
    voice_name: 'en-US-AriaNeural-Female',
    voice_rate: 1.05,
    bgm_type: 'random',
    bgm_volume: 0.12,
    subtitle_enabled: true,
    subtitle_position: 'bottom',
    font_size: 68,
    stroke_color: '#000000',
    stroke_width: 2,
  };
}

function buildNarrationScript(brief) {
  const lines = [
    brief.hook,
    cleanForNarration(brief.body),
    brief.cta ? `Try this next: ${brief.cta}` : '',
  ].filter(Boolean);
  return lines.join('\n\n');
}

function extractSearchTerms(brief) {
  const terms = [
    brief.projectSlug.replaceAll('-', ' '),
    brief.audience,
    brief.title,
    'software demo',
    'startup product',
  ].filter(Boolean);
  return Array.from(new Set(terms)).slice(0, 5);
}

function looksLikeVideoBrief(body) {
  const text = body.toLowerCase();
  return (
    text.includes('script') &&
    (text.includes('shot') || text.includes('scene')) &&
    text.includes('caption') &&
    (text.includes('asset') || text.includes('visual'))
  );
}

function cleanForNarration(text) {
  return text
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/[-*]\s+/g, '')
    .replace(/\b(asset prompts?|edit notes?|shot list|captions?):/gi, '')
    .trim();
}

function normalizeChannel(channel) {
  const value = stringOrThrow(channel, 'channel');
  if (!CHANNELS.has(value)) throw new Error(`unsupported channel: ${value}`);
  return value;
}

function normalizeRenderMode(mode) {
  const value = optionalString(mode) ?? 'stock';
  if (!['stock', 'ugc_actor', 'remotion', 'reel-maker', 'mock', 'openshorts', 'moneyprinterturbo'].includes(value)) {
    throw new Error(`unsupported renderMode: ${value}`);
  }
  return value;
}

function normalizeDuration(value) {
  const duration = Number(value ?? 20);
  if (!Number.isFinite(duration) || duration < 5 || duration > 90) {
    throw new Error('durationSeconds must be between 5 and 90');
  }
  return duration;
}

function stringOrThrow(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
