export interface MachineProfile {
  cores: number;
  totalMemGB: number;
  recommendedParallel: number;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  machine: MachineProfile;
}

export interface Preset {
  name: string;
  label: string;
  formFactor: 'mobile' | 'desktop';
}

export interface PresetsResponse {
  presets: Record<string, Preset>;
  groups: Record<string, string[]>;
}

export interface StartRunBody {
  url: string;
  runs: number;
  presets: string;
  parallel: number | string;
  tag?: string;
}

export interface RunMetrics {
  lcp?: number;
  cls?: number;
  inp?: number;
  tbt?: number;
  fcp?: number;
  ttfb?: number;
  si?: number;
  performance_score?: number;
}

export type RunnerEvent =
  | { type: 'start'; total: number; parallel: number; presets: { name: string; label: string }[] }
  | { type: 'run-start'; preset: { name: string }; runIndex: number }
  | {
      type: 'run-complete';
      preset: { name: string; label: string };
      done: number;
      total: number;
      runIndex: number;
      result: { metrics?: RunMetrics; error?: string };
    }
  | { type: 'preset-complete'; preset: { name: string } }
  | { type: 'all-complete'; elapsedMs: number };

const DEFAULT_AGENT_URLS = ['http://127.0.0.1:7777', 'http://127.0.0.1:7778', 'http://localhost:7777'];

/**
 * Whether to auto-probe the local agent on mount.
 *
 * The agent lives on localhost, so probing always fires a request to
 * 127.0.0.1:7777. When the page is served from a deployed origin and no agent
 * is running, that request fails with ERR_CONNECTION_REFUSED — which is the
 * normal "disconnected" state, not a real error, but it still surfaces as a
 * failed network request (e.g. in CI smoke probes that listen for requestfailed).
 *
 * So only auto-probe when there is a signal that a local agent is expected:
 * either the page itself is served from localhost (dev / `psi-swarm serve`), or
 * the URL carries explicit connect intent (`?agent=` / `?token=`). On a bare
 * deployed page load we stay disconnected until the user explicitly connects.
 */
export function shouldAutoProbeAgent(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, search } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  const params = new URLSearchParams(search);
  const hasConnectIntent = params.has('agent') || params.has('token');
  return isLocalHost || hasConnectIntent;
}

function withToken(url: string, token?: string): string {
  const u = new URL(url);
  if (token) u.searchParams.set('token', token);
  return u.toString();
}

export async function probeAgent(
  candidates: string[] = DEFAULT_AGENT_URLS,
  opts: { preferredUrl?: string; token?: string } = {},
): Promise<{ url: string; health: HealthResponse } | null> {
  const ordered = opts.preferredUrl
    ? [opts.preferredUrl, ...candidates.filter((c) => c !== opts.preferredUrl)]
    : candidates;
  for (const url of ordered) {
    try {
      const res = await fetch(withToken(`${url}/api/health`, opts.token), { method: 'GET' });
      if (!res.ok) continue;
      const health = (await res.json()) as HealthResponse;
      if (health?.status === 'ok') return { url, health };
    } catch {
      /* try next */
    }
  }
  return null;
}

export class AgentClient {
  constructor(public baseUrl: string, private token?: string) {}

  requestUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
    const u = new URL(path, this.baseUrl);
    if (this.token) u.searchParams.set('token', this.token);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      u.searchParams.set(key, String(value));
    }
    return u.toString();
  }

  async health(): Promise<HealthResponse> {
    const r = await fetch(this.requestUrl('/api/health'));
    if (!r.ok) throw new Error(`health: HTTP ${r.status}`);
    return r.json();
  }

  async presets(): Promise<PresetsResponse> {
    const r = await fetch(this.requestUrl('/api/presets'));
    if (!r.ok) throw new Error(`presets: HTTP ${r.status}`);
    return r.json();
  }

  async startRun(body: StartRunBody): Promise<{ runId: string }> {
    const r = await fetch(this.requestUrl('/api/run'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`startRun: HTTP ${r.status} ${txt}`);
    }
    return r.json();
  }

  async runStatus(runId: string): Promise<{ status: 'pending' | 'running' | 'complete' | 'error' }> {
    const r = await fetch(this.requestUrl(`/api/runs/${runId}`));
    if (!r.ok) throw new Error(`runStatus: HTTP ${r.status}`);
    return r.json();
  }

  async waitForRunCompletion(runId: string, pollIntervalMs = 1_500): Promise<void> {
    for (;;) {
      const status = await this.runStatus(runId);
      if (status.status === 'complete' || status.status === 'error') return;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  subscribe(runId: string, onEvent: (e: RunnerEvent) => void): () => void {
    const es = new EventSource(this.requestUrl(`/api/runs/${runId}/events`));
    es.onmessage = (msg) => {
      try {
        const e = JSON.parse(msg.data) as RunnerEvent;
        onEvent(e);
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }

  async aggregate(runId: string): Promise<{ byPreset: Record<string, Record<string, { n: number; mean: number; stddev: number; min: number; max: number; p50: number; p75: number; p90: number; p99: number } | null>> }> {
    const r = await fetch(this.requestUrl('/api/aggregate', { runId }));
    if (!r.ok) throw new Error(`aggregate: HTTP ${r.status}`);
    return r.json();
  }

  async suggestions(runId: string): Promise<{ links: { url: string; path: string; text: string }[]; sources: string[] }> {
    const r = await fetch(this.requestUrl(`/api/runs/${runId}/suggestions`));
    if (!r.ok) throw new Error(`suggestions: HTTP ${r.status}`);
    return r.json();
  }

  async diagnosis(runId: string): Promise<DiagnosisResponse> {
    const r = await fetch(this.requestUrl(`/api/runs/${runId}/diagnosis`));
    if (!r.ok) throw new Error(`diagnosis: HTTP ${r.status}`);
    return r.json();
  }

  subscribeReason(
    runId: string,
    onEvent: (e: ReasonEvent) => void,
    opts: { model?: string; backend?: 'openai' | 'local-ai' | 'auto' } = {},
  ): () => void {
    const params = new URLSearchParams();
    if (opts.model) params.set('model', opts.model);
    if (opts.backend) params.set('backend', opts.backend);
    const es = new EventSource(this.requestUrl(`/api/runs/${runId}/reason?${params.toString()}`));
    es.onmessage = (msg) => {
      try {
        onEvent(JSON.parse(msg.data) as ReasonEvent);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }

  reportUrl(pageUrl: string, which = 'latest'): string {
    return this.requestUrl('/api/report', { url: pageUrl, which });
  }
}

export interface DiagnosisResponse {
  byPreset: Record<
    string,
    {
      diagnosis: {
        preset: string;
        presetLabel?: string;
        formFactor?: 'mobile' | 'desktop';
        okRuns: number;
        lcpElement?: { snippet?: string; selector?: string; nodeLabel?: string };
        lcpPhases?: Array<{ phase: string; medianMs: number; percent: string }>;
      };
      topOpportunities: Array<{
        label: string;
        display: string;
        savings: string;
        affects: string;
        topItems: Array<{ label: string; detail?: string }>;
      }>;
    }
  >;
}

export type ReasonEvent =
  | { type: 'backend'; backend: 'openai' | 'local-ai' }
  | { type: 'chunk'; text: string }
  | { type: 'done'; modelUsed?: string; durationMs: number }
  | { type: 'error'; message: string };
