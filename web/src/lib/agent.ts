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

export async function probeAgent(candidates: string[] = DEFAULT_AGENT_URLS): Promise<{ url: string; health: HealthResponse } | null> {
  for (const url of candidates) {
    try {
      const res = await fetch(`${url}/api/health`, { method: 'GET' });
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
  constructor(public baseUrl: string) {}

  async health(): Promise<HealthResponse> {
    const r = await fetch(`${this.baseUrl}/api/health`);
    if (!r.ok) throw new Error(`health: HTTP ${r.status}`);
    return r.json();
  }

  async presets(): Promise<PresetsResponse> {
    const r = await fetch(`${this.baseUrl}/api/presets`);
    if (!r.ok) throw new Error(`presets: HTTP ${r.status}`);
    return r.json();
  }

  async startRun(body: StartRunBody): Promise<{ runId: string }> {
    const r = await fetch(`${this.baseUrl}/api/run`, {
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

  subscribe(runId: string, onEvent: (e: RunnerEvent) => void): () => void {
    const es = new EventSource(`${this.baseUrl}/api/runs/${runId}/events`);
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
    const r = await fetch(`${this.baseUrl}/api/aggregate?runId=${runId}`);
    if (!r.ok) throw new Error(`aggregate: HTTP ${r.status}`);
    return r.json();
  }

  async suggestions(runId: string): Promise<{ links: { url: string; path: string; text: string }[]; sources: string[] }> {
    const r = await fetch(`${this.baseUrl}/api/runs/${runId}/suggestions`);
    if (!r.ok) throw new Error(`suggestions: HTTP ${r.status}`);
    return r.json();
  }
}
