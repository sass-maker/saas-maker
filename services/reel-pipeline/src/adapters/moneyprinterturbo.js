import { toMoneyPrinterRequest } from '../video-brief.js';

export class MoneyPrinterTurboAdapter {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.MONEYPRINTER_API_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createVideo(brief) {
    const body = toMoneyPrinterRequest(brief);
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/videos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`MoneyPrinterTurbo create failed ${res.status}: ${await res.text()}`);
    const payload = await res.json();
    const externalTaskId = payload?.data?.task_id;
    if (!externalTaskId) throw new Error('MoneyPrinterTurbo response missing data.task_id');
    return {
      provider: 'moneyprinterturbo',
      externalTaskId,
      status: 'queued',
      request: body,
      raw: payload,
    };
  }

  async getStatus(externalTaskId) {
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1/tasks/${encodeURIComponent(externalTaskId)}`);
    if (!res.ok) throw new Error(`MoneyPrinterTurbo status failed ${res.status}: ${await res.text()}`);
    const payload = await res.json();
    const data = payload?.data ?? {};
    return {
      provider: 'moneyprinterturbo',
      externalTaskId,
      status: normalizeMoneyPrinterStatus(data.state, data.progress),
      progress: data.progress,
      videos: normalizeMoneyPrinterUrls(data.videos ?? [], this.baseUrl),
      combinedVideos: normalizeMoneyPrinterUrls(data.combined_videos ?? [], this.baseUrl),
      raw: payload,
    };
  }
}

function normalizeMoneyPrinterStatus(state, progress) {
  if (progress === 100 || state === 1 || state === 'completed') return 'completed';
  if (state === -1 || state === 'failed') return 'failed';
  return 'running';
}

function normalizeMoneyPrinterUrls(urls, baseUrl) {
  return urls.map((url) => {
    if (typeof url !== 'string') return url;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://')) return url;
    if (url.startsWith('/')) return `${baseUrl}${url}`;
    return url;
  });
}
