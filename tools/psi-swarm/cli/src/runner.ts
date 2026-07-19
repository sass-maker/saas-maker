import { EventEmitter } from 'node:events';
import { launch, type LaunchedChrome } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import type { Preset } from './presets.js';
import { captureAuditsFromLhr, type CapturedAudit } from './audits.js';

export interface MetricSet {
  lcp?: number;
  cls?: number;
  inp?: number;
  tbt?: number;
  fcp?: number;
  ttfb?: number;
  si?: number;
  performance_score?: number;
}

export interface RunResult {
  preset: Preset;
  startedAt: number;
  finishedAt: number;
  metrics?: MetricSet;
  error?: string;
}

export interface ScriptArtifact {
  url: string;
  content: string;
}

export interface RunResultWithArtifact extends RunResult {
  scripts?: ScriptArtifact[];
  audits?: CapturedAudit[];
  finalUrl?: string;
}

const CHROME_FLAGS = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
];

interface RunOnceOptions {
  captureScripts?: boolean;
  captureAudits?: boolean;
}

export async function runOnce(
  url: string,
  preset: Preset,
  opts: RunOnceOptions = {},
): Promise<RunResultWithArtifact> {
  const startedAt = Date.now();
  let chrome: LaunchedChrome | undefined;
  try {
    chrome = await launch({ chromeFlags: CHROME_FLAGS });
    const result = await lighthouse(
      url,
      {
        port: chrome.port,
        logLevel: 'silent',
        output: 'json',
      },
      {
        extends: 'lighthouse:default',
        settings: {
          onlyCategories: ['performance'],
          formFactor: preset.formFactor,
          throttling: preset.throttling,
          screenEmulation: preset.screenEmulation,
        },
      },
    );
    if (!result) throw new Error('Lighthouse returned no result');
    const lhr = result.lhr;
    const audits = lhr.audits;
    const numeric = (id: string): number | undefined => {
      const a = audits[id];
      return typeof a?.numericValue === 'number' ? a.numericValue : undefined;
    };
    const metrics: MetricSet = {
      lcp: numeric('largest-contentful-paint'),
      cls: numeric('cumulative-layout-shift'),
      inp:
        numeric('interaction-to-next-paint') ??
        numeric('experimental-interaction-to-next-paint'),
      tbt: numeric('total-blocking-time'),
      fcp: numeric('first-contentful-paint'),
      ttfb: numeric('server-response-time'),
      si: numeric('speed-index'),
      performance_score:
        typeof lhr.categories.performance?.score === 'number'
          ? lhr.categories.performance.score * 100
          : undefined,
    };
    const out: RunResultWithArtifact = {
      preset,
      startedAt,
      finishedAt: Date.now(),
      metrics,
      finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl,
    };
    if (opts.captureScripts) {
      // Lighthouse Scripts artifact contains the bundled JS source for every script
      // on the page. Perfect for framework route detection — works even on auth-gated SPAs.
      const artifacts = (result as unknown as {
        artifacts?: { Scripts?: { url?: string; content?: string }[] };
      }).artifacts;
      if (Array.isArray(artifacts?.Scripts)) {
        out.scripts = artifacts.Scripts
          .filter((s) => typeof s.content === 'string' && typeof s.url === 'string')
          .map((s) => ({ url: s.url!, content: s.content! }));
      }
    }
    if (opts.captureAudits) {
      out.audits = captureAuditsFromLhr(audits as Parameters<typeof captureAuditsFromLhr>[0]);
    }
    return out;
  } catch (err) {
    return {
      preset,
      startedAt,
      finishedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await chrome?.kill();
  }
}

export type RunnerEvent =
  | { type: 'start'; total: number; presets: Preset[]; parallel: number }
  | { type: 'run-start'; preset: Preset; presetIndex: number; runIndex: number }
  | { type: 'run-complete'; result: RunResultWithArtifact; preset: Preset; presetIndex: number; runIndex: number; done: number; total: number }
  | { type: 'preset-complete'; preset: Preset; results: RunResultWithArtifact[] }
  | { type: 'all-complete'; elapsedMs: number; results: RunResultWithArtifact[] };

export interface SwarmOptions {
  url: string;
  presets: Preset[];
  runs: number;
  parallel?: number;
  captureScripts?: boolean;
  captureAudits?: boolean;
}

export class SwarmRunner extends EventEmitter {
  async run(opts: SwarmOptions): Promise<RunResultWithArtifact[]> {
    const parallel = Math.max(1, Math.min(opts.parallel ?? 1, opts.presets.length));
    const total = opts.presets.length * opts.runs;
    const startedAt = Date.now();
    this.emit('event', {
      type: 'start',
      total,
      presets: opts.presets,
      parallel,
    } satisfies RunnerEvent);

    const allResults: RunResultWithArtifact[] = [];
    let done = 0;

    const runPreset = async (preset: Preset, presetIndex: number): Promise<RunResultWithArtifact[]> => {
      const presetResults: RunResultWithArtifact[] = [];
      // Only capture scripts on the first successful run per preset — saves memory (bundles can be MB).
      let scriptsCaptured = false;
      for (let i = 0; i < opts.runs; i++) {
        this.emit('event', {
          type: 'run-start',
          preset,
          presetIndex,
          runIndex: i,
        } satisfies RunnerEvent);
        const r = await runOnce(opts.url, preset, {
          captureScripts: opts.captureScripts && !scriptsCaptured,
          captureAudits: opts.captureAudits,
        });
        if (r.scripts) scriptsCaptured = true;
        presetResults.push(r);
        allResults.push(r);
        done++;
        this.emit('event', {
          type: 'run-complete',
          result: r,
          preset,
          presetIndex,
          runIndex: i,
          done,
          total,
        } satisfies RunnerEvent);
      }
      this.emit('event', {
        type: 'preset-complete',
        preset,
        results: presetResults,
      } satisfies RunnerEvent);
      return presetResults;
    };

    // Worker pool across presets.
    const queue = opts.presets.map((p, i) => ({ preset: p, presetIndex: i }));
    const workers: Promise<void>[] = [];
    let cursor = 0;
    const next = async (): Promise<void> => {
      while (cursor < queue.length) {
        const job = queue[cursor++];
        await runPreset(job.preset, job.presetIndex);
      }
    };
    for (let w = 0; w < parallel; w++) {
      workers.push(next());
    }
    await Promise.all(workers);

    const elapsedMs = Date.now() - startedAt;
    this.emit('event', {
      type: 'all-complete',
      elapsedMs,
      results: allResults,
    } satisfies RunnerEvent);
    return allResults;
  }
}

// Back-compat plain function for any callers that just want results.
export async function runSwarm(opts: SwarmOptions): Promise<RunResultWithArtifact[]> {
  const runner = new SwarmRunner();
  return runner.run(opts);
}
