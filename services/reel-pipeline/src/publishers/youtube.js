import { readFile, stat } from 'node:fs/promises';

const DEFAULT_OAUTH_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos';
const DEFAULT_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const DEFAULT_CATEGORY_ID = '22';
const TOKEN_SAFETY_WINDOW_MS = 60_000;

export class YouTubePublisher {
  constructor(options = {}) {
    this.clientId = options.clientId ?? process.env.YOUTUBE_OAUTH_CLIENT_ID;
    this.clientSecret = options.clientSecret ?? process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    this.refreshToken = options.refreshToken ?? process.env.YOUTUBE_OAUTH_REFRESH_TOKEN;
    this.oauthUrl = options.oauthUrl ?? DEFAULT_OAUTH_URL;
    this.uploadUrl = options.uploadUrl ?? DEFAULT_UPLOAD_URL;
    this.videosUrl = options.videosUrl ?? DEFAULT_VIDEOS_URL;
    this.defaultPrivacy = options.defaultPrivacy ?? process.env.YOUTUBE_DEFAULT_PRIVACY ?? 'private';
    this.defaultCategoryId = options.categoryId ?? process.env.YOUTUBE_CATEGORY_ID ?? DEFAULT_CATEGORY_ID;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.readFileImpl = options.readFileImpl ?? readFile;
    this.statImpl = options.statImpl ?? stat;
    this.now = options.now ?? (() => Date.now());
    this._tokenCache = null;
  }

  async accessToken() {
    if (this._tokenCache && this._tokenCache.expiresAt - TOKEN_SAFETY_WINDOW_MS > this.now()) {
      return this._tokenCache.token;
    }
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('YouTubePublisher requires clientId, clientSecret, and refreshToken');
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await this.fetchImpl(this.oauthUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`YouTube token refresh failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    if (!payload.access_token) {
      throw new Error(`YouTube token refresh missing access_token: ${JSON.stringify(payload)}`);
    }
    const expiresIn = Number(payload.expires_in ?? 3600) * 1000;
    this._tokenCache = { token: payload.access_token, expiresAt: this.now() + expiresIn };
    return this._tokenCache.token;
  }

  async upload(input) {
    if (!input?.videoPath) throw new Error('upload requires videoPath');
    const title = trimToBytes(input.title ?? 'Untitled', 100);
    const description = appendShortsTag(input.description ?? '');
    const tags = Array.isArray(input.tags) ? input.tags.slice(0, 30) : undefined;
    const categoryId = input.categoryId ?? this.defaultCategoryId;
    const publishAt = input.publishAt ? new Date(input.publishAt).toISOString() : undefined;
    const privacyStatus = publishAt ? 'private' : (input.privacyStatus ?? this.defaultPrivacy);

    const metadata = {
      snippet: { title, description, categoryId, ...(tags ? { tags } : {}) },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: Boolean(input.madeForKids),
        ...(publishAt ? { publishAt } : {}),
      },
    };

    const fileStat = await this.statImpl(input.videoPath);
    const accessToken = await this.accessToken();

    const initRes = await this.fetchImpl(`${this.uploadUrl}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-type': 'video/*',
        'x-upload-content-length': String(fileStat.size),
      },
      body: JSON.stringify(metadata),
    });
    if (!initRes.ok) {
      throw new Error(`YouTube resumable init failed ${initRes.status}: ${await initRes.text()}`);
    }
    const sessionUrl = headerValue(initRes.headers, 'location');
    if (!sessionUrl) {
      throw new Error('YouTube resumable init missing Location header');
    }

    const bytes = await this.readFileImpl(input.videoPath);
    const uploadRes = await this.fetchImpl(sessionUrl, {
      method: 'PUT',
      headers: {
        'content-type': 'video/*',
        'content-length': String(fileStat.size),
      },
      body: bytes,
    });
    if (!uploadRes.ok) {
      throw new Error(`YouTube upload failed ${uploadRes.status}: ${await uploadRes.text()}`);
    }
    const payload = await uploadRes.json();
    if (!payload.id) {
      throw new Error(`YouTube upload missing video id: ${JSON.stringify(payload)}`);
    }
    return {
      videoId: payload.id,
      url: `https://youtube.com/shorts/${payload.id}`,
      privacyStatus: payload.status?.privacyStatus ?? privacyStatus,
      publishAt: payload.status?.publishAt ?? publishAt ?? null,
      raw: payload,
    };
  }

  async videoAnalytics(videoId) {
    if (!videoId) throw new Error('videoAnalytics requires videoId');
    const accessToken = await this.accessToken();
    const url = new URL(this.videosUrl);
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', videoId);
    const res = await this.fetchImpl(url.toString(), {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`YouTube analytics failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    const item = payload.items?.[0];
    if (!item) throw new Error(`YouTube analytics missing video ${videoId}`);
    const stats = item.statistics ?? {};
    return {
      provider: 'youtube',
      postId: videoId,
      metrics: {
        views: numberOrNull(stats.viewCount),
        likes: numberOrNull(stats.likeCount),
        comments: numberOrNull(stats.commentCount),
      },
      raw: payload,
    };
  }
}

function appendShortsTag(description) {
  if (/#shorts/i.test(description)) return description;
  return description ? `${description}\n\n#Shorts` : '#Shorts';
}

function trimToBytes(text, max) {
  return text.length > max ? text.slice(0, max) : text;
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
