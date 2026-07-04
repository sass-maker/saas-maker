const DEFAULT_GRAPH_URL = 'https://graph.instagram.com';
const DEFAULT_API_VERSION = 'v22.0';
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_POLL_TIMEOUT_MS = 5 * 60_000;
const TERMINAL_STATUSES = new Set(['FINISHED', 'ERROR', 'EXPIRED']);
const DEFAULT_INSIGHT_METRICS = ['views', 'likes', 'comments', 'shares', 'saved'];

export class InstagramPublisher {
  constructor(options = {}) {
    this.userId = options.userId;
    this.longLivedToken = options.longLivedToken;
    this.graphUrl = (options.graphUrl ?? DEFAULT_GRAPH_URL).replace(/\/$/, '');
    this.apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = options.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? (() => Date.now());
  }

  base() {
    return `${this.graphUrl}/${this.apiVersion}`;
  }

  async publishReel(input) {
    if (!this.userId) throw new Error('InstagramPublisher requires userId');
    if (!this.longLivedToken) throw new Error('InstagramPublisher requires longLivedToken');
    if (!input?.videoUrl) throw new Error('publishReel requires videoUrl');
    if (!isHttpUrl(input.videoUrl)) {
      throw new Error(`InstagramPublisher.videoUrl must be a public http(s) URL (got ${input.videoUrl})`);
    }

    const containerId = await this.createContainer(input);
    const status = await this.waitForContainer(containerId);
    if (status !== 'FINISHED') {
      throw new Error(`Instagram container ${containerId} ended in ${status}`);
    }
    return this.publishContainer(containerId);
  }

  async createContainer(input) {
    const body = new URLSearchParams({
      media_type: 'REELS',
      video_url: input.videoUrl,
      caption: input.caption ?? '',
      access_token: this.longLivedToken,
    });
    if (input.shareToFeed === false) body.set('share_to_feed', 'false');
    if (input.thumbOffsetMs) body.set('thumb_offset', String(input.thumbOffsetMs));
    const res = await this.fetchImpl(`${this.base()}/${this.userId}/media`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Instagram createContainer failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    if (!payload.id) throw new Error(`Instagram createContainer missing id: ${JSON.stringify(payload)}`);
    return payload.id;
  }

  async waitForContainer(containerId) {
    const deadline = this.now() + this.pollTimeoutMs;
    let last = 'IN_PROGRESS';
    while (this.now() < deadline) {
      const url = `${this.base()}/${containerId}?fields=status_code&access_token=${encodeURIComponent(this.longLivedToken)}`;
      const res = await this.fetchImpl(url);
      if (!res.ok) throw new Error(`Instagram waitForContainer failed ${res.status}: ${await res.text()}`);
      const payload = await res.json();
      last = payload.status_code ?? 'IN_PROGRESS';
      if (TERMINAL_STATUSES.has(last)) return last;
      await this.sleepImpl(this.pollIntervalMs);
    }
    throw new Error(`Instagram container ${containerId} did not finish within ${this.pollTimeoutMs}ms (last=${last})`);
  }

  async publishContainer(containerId) {
    const body = new URLSearchParams({
      creation_id: containerId,
      access_token: this.longLivedToken,
    });
    const res = await this.fetchImpl(`${this.base()}/${this.userId}/media_publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`Instagram media_publish failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    if (!payload.id) throw new Error(`Instagram media_publish missing id: ${JSON.stringify(payload)}`);
    return {
      mediaId: payload.id,
      url: `https://www.instagram.com/reel/${payload.id}/`,
      raw: payload,
    };
  }

  async refreshLongLivedToken() {
    if (!this.longLivedToken) throw new Error('refreshLongLivedToken requires longLivedToken');
    const url = `${this.base()}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(this.longLivedToken)}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Instagram refresh failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    if (!payload.access_token) {
      throw new Error(`Instagram refresh missing access_token: ${JSON.stringify(payload)}`);
    }
    return {
      longLivedToken: payload.access_token,
      expiresInSeconds: Number(payload.expires_in ?? 0),
    };
  }

  async mediaInsights(mediaId, metrics = DEFAULT_INSIGHT_METRICS) {
    if (!this.longLivedToken) throw new Error('mediaInsights requires longLivedToken');
    if (!mediaId) throw new Error('mediaInsights requires mediaId');
    const metricList = metrics.join(',');
    const url = `${this.base()}/${encodeURIComponent(mediaId)}/insights?metric=${encodeURIComponent(metricList)}&access_token=${encodeURIComponent(this.longLivedToken)}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) {
      throw new Error(`Instagram mediaInsights failed ${res.status}: ${await res.text()}`);
    }
    const payload = await res.json();
    return {
      provider: 'instagram',
      postId: mediaId,
      metrics: normalizeInsights(payload),
      raw: payload,
    };
  }
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function normalizeInsights(payload) {
  const metrics = {};
  for (const item of payload?.data ?? []) {
    const value = item.values?.[0]?.value ?? item.total_value?.value ?? null;
    metrics[item.name] = numberOrNull(value);
  }
  return metrics;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
