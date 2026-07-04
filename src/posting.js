import { SaaSMakerClient } from './saas-maker-client.js';
import { YouTubePublisher } from './publishers/youtube.js';
import { InstagramPublisher } from './publishers/instagram.js';
import { AccountRouter } from './config/social-accounts.js';

const REEL_CHANNELS = new Set(['tiktok', 'instagram_reels', 'youtube_shorts']);
const HTTP_URL_RE = /^https?:\/\//i;

export const POSTING_CAPABILITIES = Object.freeze({
  manual: Object.freeze({
    provider: 'manual',
    channels: ['tiktok', 'instagram_reels', 'youtube_shorts'],
    requiresRenderedAsset: true,
    requiresPublicVideoUrl: false,
    requiresLocalVideo: false,
    supportsScheduledPublish: false,
    maxCaptionLength: 4096,
  }),
  'upload-post': Object.freeze({
    provider: 'upload-post',
    channels: ['tiktok', 'instagram_reels', 'youtube_shorts'],
    requiresRenderedAsset: true,
    requiresPublicVideoUrl: true,
    requiresLocalVideo: false,
    supportsScheduledPublish: false,
    maxCaptionLength: 4096,
  }),
  youtube: Object.freeze({
    provider: 'youtube',
    channels: ['youtube_shorts'],
    requiresRenderedAsset: true,
    requiresPublicVideoUrl: false,
    requiresLocalVideo: true,
    supportsScheduledPublish: true,
    maxCaptionLength: 5000,
    maxTitleLength: 100,
    maxTags: 30,
  }),
  instagram: Object.freeze({
    provider: 'instagram',
    channels: ['instagram_reels'],
    requiresRenderedAsset: true,
    requiresPublicVideoUrl: true,
    requiresLocalVideo: false,
    supportsScheduledPublish: false,
    maxCaptionLength: 2200,
  }),
});

export class PostingPreflightError extends Error {
  constructor(message, category = 'bad_asset') {
    super(message);
    this.name = 'PostingPreflightError';
    this.category = category;
  }
}

export class ManualPostingProvider {
  constructor(options = {}) {
    this.now = options.now ?? (() => new Date());
    this.capabilities = POSTING_CAPABILITIES.manual;
  }

  async post(marketingPost) {
    assertPostingPreflight(marketingPost, this.capabilities);
    return {
      provider: 'manual',
      status: 'prepared',
      channel: marketingPost.channel,
      assetUrl: marketingPost.result_url ?? marketingPost.asset_url,
      externalUrl: null,
      preparedAt: this.now().toISOString(),
      instructions: `Review and manually upload ${marketingPost.title} to ${marketingPost.channel}.`,
    };
  }
}

export class UploadPostProvider {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.UPLOAD_POST_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.UPLOAD_POST_API_URL ?? 'https://api.upload-post.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.capabilities = POSTING_CAPABILITIES['upload-post'];
  }

  async post(marketingPost) {
    assertPostingPreflight(marketingPost, this.capabilities);
    if (!this.apiKey) throw new Error('missing UPLOAD_POST_API_KEY');
    const res = await this.fetchImpl(`${this.baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        platform: platformForChannel(marketingPost.channel),
        video_url: marketingPost.result_url ?? marketingPost.asset_url,
        caption: buildCaption(marketingPost),
      }),
    });
    if (!res.ok) throw new Error(`Upload-Post failed ${res.status}: ${await res.text()}`);
    const payload = await res.json();
    return {
      provider: 'upload-post',
      status: 'posted',
      channel: marketingPost.channel,
      assetUrl: marketingPost.result_url ?? marketingPost.asset_url,
      externalId: payload.id ?? payload.post_id ?? null,
      externalUrl: payload.url ?? payload.post_url ?? null,
      postedAt: new Date().toISOString(),
      raw: payload,
    };
  }
}

export class YouTubePostingProvider {
  constructor(options = {}) {
    this.resolveLocalPath = options.resolveLocalPath ?? defaultLocalPathResolver;
    this.capabilities = POSTING_CAPABILITIES.youtube;
    if (options.publisher) {
      this.singlePublisher = options.publisher;
    } else if (options.accounts) {
      this.router = new AccountRouter(options.accounts);
      this.publisherCache = new Map();
      this.publisherFactory = options.publisherFactory ?? ((account) => new YouTubePublisher(account));
    } else {
      throw new Error('YouTubePostingProvider requires `accounts` config or a `publisher`');
    }
  }

  publisherFor(marketingPost) {
    if (this.singlePublisher) return { publisher: this.singlePublisher, accountSlug: null };
    const account = this.router.route(marketingPost);
    if (!this.publisherCache.has(account.slug)) {
      this.publisherCache.set(account.slug, this.publisherFactory(account));
    }
    return { publisher: this.publisherCache.get(account.slug), accountSlug: account.slug };
  }

  async post(marketingPost) {
    if (marketingPost.channel !== 'youtube_shorts') {
      throw new Error(`YouTubePostingProvider only handles youtube_shorts (got ${marketingPost.channel})`);
    }
    const videoPath = await this.resolveLocalPath(marketingPost);
    assertPostingPreflight(marketingPost, this.capabilities, { localVideoPath: videoPath });
    const { publisher, accountSlug } = this.publisherFor(marketingPost);
    const result = await publisher.upload({
      videoPath,
      title: marketingPost.title,
      description: buildCaption(marketingPost),
      tags: marketingPost.tags,
      publishAt: marketingPost.scheduled_for,
    });
    return {
      provider: 'youtube',
      accountSlug,
      status: result.publishAt ? 'scheduled' : 'posted',
      channel: marketingPost.channel,
      assetUrl: marketingPost.result_url ?? marketingPost.asset_url,
      externalId: result.videoId,
      externalUrl: result.url,
      postedAt: result.publishAt ? null : new Date().toISOString(),
      scheduledFor: result.publishAt,
      raw: result.raw,
    };
  }
}

export class InstagramPostingProvider {
  constructor(options = {}) {
    this.capabilities = POSTING_CAPABILITIES.instagram;
    if (options.publisher) {
      this.singlePublisher = options.publisher;
    } else if (options.accounts) {
      this.router = new AccountRouter(options.accounts);
      this.publisherCache = new Map();
      this.publisherFactory = options.publisherFactory ?? ((account) => new InstagramPublisher(account));
    } else {
      throw new Error('InstagramPostingProvider requires `accounts` config or a `publisher`');
    }
  }

  publisherFor(marketingPost) {
    if (this.singlePublisher) return { publisher: this.singlePublisher, accountSlug: null };
    const account = this.router.route(marketingPost);
    if (!this.publisherCache.has(account.slug)) {
      this.publisherCache.set(account.slug, this.publisherFactory(account));
    }
    return { publisher: this.publisherCache.get(account.slug), accountSlug: account.slug };
  }

  async post(marketingPost) {
    if (marketingPost.channel !== 'instagram_reels') {
      throw new Error(`InstagramPostingProvider only handles instagram_reels (got ${marketingPost.channel})`);
    }
    const videoUrl = marketingPost.result_url ?? marketingPost.asset_url;
    assertPostingPreflight(marketingPost, this.capabilities);
    const { publisher, accountSlug } = this.publisherFor(marketingPost);
    const result = await publisher.publishReel({
      videoUrl,
      caption: buildCaption(marketingPost),
    });
    return {
      provider: 'instagram',
      accountSlug,
      status: 'posted',
      channel: marketingPost.channel,
      assetUrl: videoUrl,
      externalId: result.mediaId,
      externalUrl: result.url,
      postedAt: new Date().toISOString(),
      raw: result.raw,
    };
  }
}

export function createPostingProvider(mode = 'manual', options = {}) {
  if (mode === 'manual') return new ManualPostingProvider(options.manual);
  if (mode === 'upload-post') return new UploadPostProvider(options.uploadPost);
  if (mode === 'youtube') return new YouTubePostingProvider(options.youtube);
  if (mode === 'instagram') return new InstagramPostingProvider(options.instagram);
  if (mode === 'auto') return new ChannelRoutingProvider(options);
  throw new Error(`unsupported posting provider: ${mode}`);
}

export class ChannelRoutingProvider {
  constructor(options = {}) {
    this.providers = {
      youtube_shorts: options.youtubeProvider ?? (options.youtube ? new YouTubePostingProvider(options.youtube) : null),
      instagram_reels: options.instagramProvider ?? (options.instagram ? new InstagramPostingProvider(options.instagram) : null),
    };
    this.fallback = options.fallback ?? new ManualPostingProvider(options.manual);
  }

  async post(marketingPost) {
    const provider = this.providers[marketingPost.channel] ?? this.fallback;
    if (provider?.capabilities) {
      assertPostingPreflight(marketingPost, provider.capabilities);
    }
    return provider.post(marketingPost);
  }
}

function defaultLocalPathResolver(post) {
  return post.local_path ?? post.result_path ?? post.asset_path ?? null;
}

export async function postReadyMarketingVideos(options = {}) {
  if (!options.confirmPost) {
    throw new Error('posting requires confirmPost=true');
  }

  const client = options.saasMakerClient ?? new SaaSMakerClient(options.saasMaker);
  const provider = options.provider ?? createPostingProvider(options.providerMode ?? 'manual', options);
  const posts = await client.listMarketingPosts({
    status: 'accepted',
    limit: options.limit ?? 20,
    ...(options.projectSlug ? { project_slug: options.projectSlug } : {}),
    ...(options.channel ? { channel: options.channel } : {}),
  });
  const now = options.now ?? new Date();
  const results = [];

  for (const post of posts) {
    if (options.missedOnly && !isMissedReadyPost(post, now)) {
      results.push({ postId: post.id, skipped: true, reason: 'not missed ready post' });
      continue;
    }

    const gate = postingGate(post, { now, includeUnscheduled: options.includeUnscheduled });
    if (!gate.ready) {
      results.push({ postId: post.id, skipped: true, reason: gate.reason });
      continue;
    }

    try {
      const posted = await provider.post(post);
      const patch = patchForPostingResult(post, posted);
      const sync = await client.updateMarketingPost(post.id, patch);
      results.push({ postId: post.id, posted, sync });
    } catch (error) {
      const failure = classifyPostingError(error);
      const patch = patchForPostingFailure(post, failure);
      const sync = await client.updateMarketingPost(post.id, patch);
      results.push({ postId: post.id, skipped: true, reason: failure.message, failure, sync });
    }
  }

  return { scanned: posts.length, results };
}

export function patchForPostingResult(post, posted) {
  const patch = {
      status: posted.status === 'posted' ? 'sent' : 'accepted',
      result_url: posted.externalUrl ?? post.result_url ?? post.asset_url,
      notes: appendPostingNotes(post.notes, posted),
    };

  if (posted.status === 'posted') {
    patch.posted_at = posted.postedAt;
  } else if (posted.status === 'scheduled' && posted.scheduledFor) {
    patch.scheduled_for = posted.scheduledFor;
  }

  return patch;
}

export function patchForPostingFailure(post, failure) {
  return {
    status: 'accepted',
    result_url: post.result_url ?? post.asset_url,
    notes: appendPostingFailureNotes(post.notes, failure),
  };
}

export function postingGate(post, options = {}) {
  if (!REEL_CHANNELS.has(post.channel)) return { ready: false, reason: 'not a reel channel' };
  if (post.status !== 'accepted') return { ready: false, reason: 'not accepted' };
  if (!post.result_url && !post.asset_url) return { ready: false, reason: 'missing rendered asset' };
  if (post.posted_at) return { ready: false, reason: 'already posted' };
  if (!options.includeUnscheduled && !post.scheduled_for) return { ready: false, reason: 'not scheduled' };
  if (post.scheduled_for && new Date(post.scheduled_for) > options.now) return { ready: false, reason: 'scheduled for later' };
  return { ready: true };
}

export function isMissedReadyPost(post, now = new Date()) {
  if (!REEL_CHANNELS.has(post.channel)) return false;
  if (post.status !== 'accepted') return false;
  if (!post.result_url && !post.asset_url && !defaultLocalPathResolver(post)) return false;
  if (post.posted_at) return false;
  if (!post.scheduled_for) return false;
  const scheduledFor = new Date(post.scheduled_for);
  if (Number.isNaN(scheduledFor.getTime())) return false;
  return scheduledFor <= now;
}

export function validatePostingPreflight(post, capabilities = POSTING_CAPABILITIES.manual, options = {}) {
  if (capabilities.channels?.length && !capabilities.channels.includes(post.channel)) {
    return {
      ok: false,
      category: 'bad_channel',
      reason: `${capabilities.provider} does not support channel ${post.channel}`,
    };
  }

  const assetUrl = post.result_url ?? post.asset_url;
  const localVideoPath = options.localVideoPath ?? defaultLocalPathResolver(post);
  if (capabilities.requiresRenderedAsset && !assetUrl && !localVideoPath) {
    return { ok: false, category: 'bad_asset', reason: 'missing rendered asset' };
  }
  if (capabilities.requiresPublicVideoUrl && assetUrl && !HTTP_URL_RE.test(assetUrl)) {
    return {
      ok: false,
      category: 'bad_asset',
      reason: `${capabilities.provider} requires a public http(s) video URL`,
    };
  }
  if (capabilities.requiresLocalVideo && !localVideoPath) {
    return {
      ok: false,
      category: 'bad_asset',
      reason: `${capabilities.provider} requires a local video path`,
    };
  }

  const caption = buildCaption(post) ?? '';
  if (capabilities.maxCaptionLength && caption.length > capabilities.maxCaptionLength) {
    return {
      ok: false,
      category: 'bad_caption',
      reason: `${capabilities.provider} caption exceeds ${capabilities.maxCaptionLength} characters`,
    };
  }
  if (capabilities.maxTitleLength && post.title && post.title.length > capabilities.maxTitleLength) {
    return {
      ok: false,
      category: 'bad_caption',
      reason: `${capabilities.provider} title exceeds ${capabilities.maxTitleLength} characters`,
    };
  }
  if (capabilities.maxTags && Array.isArray(post.tags) && post.tags.length > capabilities.maxTags) {
    return {
      ok: false,
      category: 'bad_caption',
      reason: `${capabilities.provider} allows at most ${capabilities.maxTags} tags`,
    };
  }

  return { ok: true };
}

export function assertPostingPreflight(post, capabilities, options = {}) {
  const result = validatePostingPreflight(post, capabilities, options);
  if (!result.ok) throw new PostingPreflightError(result.reason, result.category);
  return result;
}

export function classifyPostingError(error) {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown posting error');
  const lower = message.toLowerCase();
  if (error?.category) return { category: error.category, retryable: false, message };
  if (lower.includes('quota')) return { category: 'quota', retryable: true, message };
  if (lower.includes('token') || lower.includes('oauth') || lower.includes('401') || lower.includes('403')) {
    return { category: 'needs_reconnect', retryable: false, message };
  }
  if (lower.includes('429') || lower.includes('rate limit')) return { category: 'rate_limited', retryable: true, message };
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('503') || lower.includes('502') || lower.includes('500')) {
    return { category: 'provider_down', retryable: true, message };
  }
  if (lower.includes('caption') || lower.includes('title') || lower.includes('too long')) {
    return { category: 'bad_caption', retryable: false, message };
  }
  if (lower.includes('video') || lower.includes('asset') || lower.includes('container')) {
    return { category: 'bad_asset', retryable: false, message };
  }
  return { category: 'unknown', retryable: true, message };
}

function appendPostingNotes(existingNotes, posted) {
  const lines = [
    existingNotes,
    'Posting gate handled by reel-pipeline.',
    `posting_provider: ${posted.provider}`,
    `posting_status: ${posted.status}`,
    posted.preparedAt ? `prepared_at: ${posted.preparedAt}` : null,
    posted.externalId ? `external_id: ${posted.externalId}` : null,
    posted.externalUrl ? `external_url: ${posted.externalUrl}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function appendPostingFailureNotes(existingNotes, failure) {
  const lines = [
    existingNotes,
    'Posting gate handled by reel-pipeline.',
    'posting_status: error',
    `posting_error_category: ${failure.category}`,
    `posting_error_retryable: ${failure.retryable ? 'true' : 'false'}`,
    `posting_error: ${failure.message}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function platformForChannel(channel) {
  if (channel === 'youtube_shorts') return 'youtube';
  if (channel === 'instagram_reels') return 'instagram';
  return channel;
}

function buildCaption(post) {
  return [post.hook, post.cta].filter(Boolean).join('\n\n') || post.title;
}
