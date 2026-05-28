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
    renderMode: normalizeRenderMode(input.renderMode ?? input.render_mode),
    durationSeconds: normalizeDuration(input.durationSeconds ?? input.duration_seconds),
  };

  if (isReelChannel(brief.channel) && !looksLikeVideoBrief(brief.body)) {
    throw new Error('reel channel body must include script, shot list, captions, and asset prompts');
  }

  return brief;
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
