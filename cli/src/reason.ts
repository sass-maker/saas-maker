import { computeStats } from './stats.js';
import type { Diagnosis } from './diagnose.js';
import type { RunResultWithArtifact, MetricSet } from './runner.js';

const DEFAULT_GATEWAY = 'https://free-ai-gateway.sarthakagrawal927.workers.dev';
const DEFAULT_PROJECT = 'psi-swarm';

const SYSTEM_PROMPT = `You are analysing Lighthouse-derived performance data for a webpage. The data comes from N repeated Lighthouse runs against the same URL under controlled lab conditions (emulated network and CPU). Your job is to explain WHY the metrics are what they are and what specific changes would most improve them.

Core Web Vitals thresholds:
- LCP: ≤2.5s good, 2.5-4s needs work, >4s poor
- INP: ≤200ms good, 200-500ms needs work, >500ms poor (not measured in lab)
- CLS: ≤0.1 good, 0.1-0.25 needs work, >0.25 poor
- TBT: ≤200ms good, 200-600ms needs work, >600ms poor
- FCP: ≤1.8s good, 1.8-3s needs work, >3s poor
- TTFB: ≤800ms good, 800-1800ms needs work, >1800ms poor

You will be given:
1. Aggregated metric percentiles per preset (mobile / desktop).
2. Ranked Lighthouse opportunities — what to fix, with estimated savings.
3. The LCP element identification when available.

Respond in plain text (no markdown headers, no asterisks, no bullets unless natural). 4-7 sentences. Be specific: cite the actual byte counts, time savings, and LCP element names that appear in the data. Do not invent numbers. Do not give generic advice ("optimise images") — say which images, by URL or selector, and how much they would save. If the data does not support a confident root-cause, say so.

Order: (1) what's bad in one sentence, (2) the most likely cause grounded in the audit data, (3) the highest-impact fix with the expected gain, (4) a secondary fix if material.`;

export interface ReasonOptions {
  model?: string;
  gatewayUrl?: string;
  projectId?: string;
  apiKey?: string;
  onChunk?: (chunk: string) => void;
}

function compactMetrics(results: RunResultWithArtifact[]): Record<string, Record<string, number | null>> {
  const out: Record<string, Record<string, number | null>> = {};
  const byPreset = new Map<string, RunResultWithArtifact[]>();
  for (const r of results) {
    if (r.error) continue;
    const arr = byPreset.get(r.preset.name) ?? [];
    arr.push(r);
    byPreset.set(r.preset.name, arr);
  }
  const keys: (keyof MetricSet)[] = ['lcp', 'cls', 'tbt', 'fcp', 'ttfb', 'si', 'performance_score'];
  for (const [name, rs] of byPreset) {
    const block: Record<string, number | null> = {};
    for (const k of keys) {
      const vs = rs.map((r) => r.metrics?.[k]).filter((v): v is number => typeof v === 'number');
      const s = computeStats(vs);
      block[`${k}_p50`] = s ? Math.round(s.p50 * 100) / 100 : null;
      block[`${k}_p75`] = s ? Math.round(s.p75 * 100) / 100 : null;
      block[`${k}_p99`] = s ? Math.round(s.p99 * 100) / 100 : null;
      block[`${k}_stddev`] = s ? Math.round(s.stddev * 100) / 100 : null;
    }
    block['n'] = rs.length;
    out[name] = block;
  }
  return out;
}

function compactDiagnosis(d: Diagnosis): Record<string, unknown> {
  const ops = d.audits
    .filter((a) => a.failedIn / Math.max(1, a.totalRuns) >= 0.5)
    .slice(0, 12)
    .map((a) => {
      const top = a.topItems.slice(0, 3).map((it) => ({
        url: it.url,
        selector: it.node?.selector,
        snippet: it.node?.snippet?.slice(0, 140) ?? it.snippet?.slice(0, 140),
        wastedBytes: it.wastedBytes,
        wastedMs: it.wastedMs,
        totalBytes: it.totalBytes,
      }));
      return {
        id: a.spec.id,
        label: a.spec.label,
        kind: a.spec.kind,
        affects: a.spec.affects,
        failedInRuns: a.failedIn,
        ofRuns: a.totalRuns,
        medianValue: a.medianNumericValue,
        unit: a.unit,
        displayValue: a.displayValue,
        topItems: top,
      };
    });
  return {
    preset: d.preset,
    presetLabel: d.presetLabel,
    formFactor: d.formFactor,
    runs: d.runs,
    okRuns: d.okRuns,
    lcpElement: d.lcpElement,
    lcpPhases: d.lcpPhases,
    rankedOpportunities: ops,
  };
}

export function buildReasoningPayload(
  url: string,
  results: RunResultWithArtifact[],
  diagnoses: Diagnosis[],
): { url: string; metrics: Record<string, Record<string, number | null>>; perPresetDiagnosis: Record<string, unknown> } {
  const perPreset: Record<string, unknown> = {};
  for (const d of diagnoses) perPreset[d.preset] = compactDiagnosis(d);
  return { url, metrics: compactMetrics(results), perPresetDiagnosis: perPreset };
}

export interface ReasonResult {
  text: string;
  modelUsed?: string;
  durationMs: number;
}

/**
 * Stream a reasoning response from the free-ai gateway. Reads FREE_AI_API_KEY
 * from the environment unless an explicit apiKey is passed.
 */
export async function streamReasoning(
  url: string,
  results: RunResultWithArtifact[],
  diagnoses: Diagnosis[],
  opts: ReasonOptions = {},
): Promise<ReasonResult> {
  const apiKey = opts.apiKey ?? process.env.FREE_AI_API_KEY ?? process.env.GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing FREE_AI_API_KEY env var. Set it to a key issued by the free-ai gateway operator.',
    );
  }
  const gateway = opts.gatewayUrl ?? process.env.FREE_AI_GATEWAY_URL ?? DEFAULT_GATEWAY;
  const projectId = opts.projectId ?? process.env.FREE_AI_PROJECT_ID ?? DEFAULT_PROJECT;
  const model = opts.model ?? 'auto';

  const payload = buildReasoningPayload(url, results, diagnoses);
  const startedAt = Date.now();

  const body = JSON.stringify({
    model,
    project_id: projectId,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Analyse this swarm. URL = ${url}\n\nData (JSON):\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });

  const res = await fetch(`${gateway}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Gateway-Project-Id': projectId,
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`gateway HTTP ${res.status}: ${txt.slice(0, 400)}`);
  }
  if (!res.body) throw new Error('gateway returned no body');

  let acc = '';
  let modelUsed: string | undefined;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        modelUsed = parsed.model ?? modelUsed;
        const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (delta) {
          acc += delta;
          opts.onChunk?.(delta);
        }
      } catch {
        /* skip malformed chunk */
      }
    }
  }

  return { text: acc.trim(), modelUsed, durationMs: Date.now() - startedAt };
}
