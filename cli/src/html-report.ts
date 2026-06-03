import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunResultWithArtifact } from './runner.js';
import { computeStats } from './stats.js';
import { diagnosePreset, rankOpportunities, formatAggregatedAudit } from './diagnose.js';
import type { CruxRecord } from './crux.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Astro builds the static report at web/dist/r/index.html.
// In dev (`npm run dev`) cli/dist doesn't exist, so we look relative to source.
const TEMPLATE_CANDIDATES = [
  resolve(__dirname, '../../web/dist/r/index.html'),
  resolve(__dirname, '../../../web/dist/r/index.html'),
];

function findTemplate(): string {
  for (const p of TEMPLATE_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Astro template not found. Run "npm run build:web" first (creates web/dist/r/index.html). Looked in:\n${TEMPLATE_CANDIDATES.map((p) => `  ${p}`).join('\n')}`,
  );
}

export interface HtmlReportOptions {
  url: string;
  results: RunResultWithArtifact[];
  elapsedMs: number;
  cruxByFormFactor?: { mobile?: CruxRecord | null; desktop?: CruxRecord | null };
  trafficProfile?: { name: string; weights: Record<string, number> };
  reasoning?: { text: string; backend?: string; model?: string; durationMs?: number };
  generatedAt?: Date;
}

interface Stats {
  n: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
}

function statsOrNull(s: ReturnType<typeof computeStats>): Stats | null {
  return s;
}

function buildPsiData(opts: HtmlReportOptions) {
  const { url, results, elapsedMs, cruxByFormFactor, trafficProfile, reasoning } = opts;
  const okResults = results.filter((r) => !r.error);
  const errors = results.length - okResults.length;

  const byPreset = new Map<string, RunResultWithArtifact[]>();
  for (const r of okResults) {
    const arr = byPreset.get(r.preset.name) ?? [];
    arr.push(r);
    byPreset.set(r.preset.name, arr);
  }

  const presetsOrder = Array.from(byPreset.keys());
  const perPreset: Record<string, unknown> = {};

  const metricKeys = ['lcp', 'cls', 'inp', 'tbt', 'fcp', 'ttfb', 'si', 'performance_score'] as const;
  for (const name of presetsOrder) {
    const rs = byPreset.get(name)!;
    const stats: Record<string, Stats | null> = {};
    for (const k of metricKeys) {
      const vals = rs.map((r) => r.metrics?.[k]).filter((v): v is number => typeof v === 'number');
      stats[k] = statsOrNull(computeStats(vals));
    }
    const d = diagnosePreset(url, name, rs, rs[0].preset.label, rs[0].preset.formFactor);
    const ranked = rankOpportunities(d, 6).map(formatAggregatedAudit);
    perPreset[name] = {
      label: rs[0].preset.label,
      formFactor: rs[0].preset.formFactor,
      n: rs.length,
      stats,
      lcpElement: d.lcpElement,
      lcpPhases: d.lcpPhases,
      topOpportunities: ranked,
    };
  }

  // Lab vs field gap.
  const labVsField: Array<{
    formFactor: 'mobile' | 'desktop';
    labP75Ms: number;
    fieldP75Ms: number;
    ratio: number;
    verdictKind: 'matches' | 'pessimistic' | 'optimistic';
  }> = [];
  if (cruxByFormFactor) {
    for (const [factor, rec] of [
      ['mobile', cruxByFormFactor.mobile] as const,
      ['desktop', cruxByFormFactor.desktop] as const,
    ]) {
      if (!rec || !rec.metrics.lcp) continue;
      const labLcps: number[] = [];
      for (const [, runs] of byPreset) {
        const p = runs[0]?.preset;
        if (!p || p.formFactor !== factor) continue;
        for (const r of runs) if (typeof r.metrics?.lcp === 'number') labLcps.push(r.metrics.lcp);
      }
      const labStats = computeStats(labLcps);
      if (!labStats) continue;
      const fieldLcp = rec.metrics.lcp.p75;
      const ratio = labStats.p75 / fieldLcp;
      const verdictKind: 'matches' | 'pessimistic' | 'optimistic' =
        ratio >= 1.5 ? 'pessimistic' : ratio <= 0.67 ? 'optimistic' : 'matches';
      labVsField.push({ formFactor: factor, labP75Ms: labStats.p75, fieldP75Ms: fieldLcp, ratio, verdictKind });
    }
  }

  // Weighted verdict.
  let weightedVerdict;
  if (trafficProfile) {
    const usedWeights: { preset: string; weight: number }[] = [];
    let totalWeight = 0;
    for (const [name] of byPreset) {
      const w = trafficProfile.weights[name];
      if (typeof w === 'number' && w > 0) {
        usedWeights.push({ preset: name, weight: w });
        totalWeight += w;
      }
    }
    if (usedWeights.length > 0) {
      const metricSpecs = [
        { key: 'lcp' as const, label: 'LCP', good: 2500, poor: 4000 },
        { key: 'cls' as const, label: 'CLS', good: 0.1, poor: 0.25 },
        { key: 'tbt' as const, label: 'TBT', good: 200, poor: 600 },
      ];
      const metrics: { label: string; value: string; tier: 'good' | 'warn' | 'poor' | 'dim' }[] = [];
      for (const m of metricSpecs) {
        let weightedSum = 0;
        let weightAccum = 0;
        for (const { preset, weight } of usedWeights) {
          const rs = byPreset.get(preset);
          if (!rs) continue;
          const vals = rs.map((r) => r.metrics?.[m.key]).filter((v): v is number => typeof v === 'number');
          const s = computeStats(vals);
          if (!s) continue;
          weightedSum += s.p75 * weight;
          weightAccum += weight;
        }
        if (weightAccum === 0) continue;
        const wp75 = weightedSum / weightAccum;
        const tier: 'good' | 'warn' | 'poor' = wp75 <= m.good ? 'good' : wp75 <= m.poor ? 'warn' : 'poor';
        const display = m.key === 'cls' ? wp75.toFixed(3) : wp75 >= 1000 ? `${(wp75 / 1000).toFixed(2)}s` : `${Math.round(wp75)}ms`;
        metrics.push({ label: m.label, value: display, tier });
      }
      const breakdown = usedWeights.map(({ preset, weight }) => `${Math.round((weight / totalWeight) * 100)}% ${preset}`).join(' + ');
      weightedVerdict = { profile: trafficProfile.name, breakdown, metrics };
    }
  }

  // CWV LCP gate (naive overall).
  let cwvGate: { tier: 'good' | 'warn' | 'poor'; p75Ms: number } | undefined;
  const allLcps = okResults.map((r) => r.metrics?.lcp).filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  if (allLcps.length > 0) {
    const p75 = allLcps[Math.floor(0.75 * (allLcps.length - 1))];
    const tier: 'good' | 'warn' | 'poor' = p75 <= 2500 ? 'good' : p75 <= 4000 ? 'warn' : 'poor';
    cwvGate = { tier, p75Ms: p75 };
  }

  // CrUX shape simplified to what the React component expects.
  let cruxShape;
  if (cruxByFormFactor) {
    const mapRec = (rec?: CruxRecord | null) => {
      if (!rec) return null;
      return {
        source: rec.source,
        collectionPeriod: rec.collectionPeriod,
        metrics: {
          lcp: rec.metrics.lcp,
          cls: rec.metrics.cls,
          inp: rec.metrics.inp,
          fcp: rec.metrics.fcp,
          ttfb: rec.metrics.ttfb,
        },
      };
    };
    cruxShape = { mobile: mapRec(cruxByFormFactor.mobile), desktop: mapRec(cruxByFormFactor.desktop) };
  }

  return {
    url,
    elapsedMs,
    runsCount: results.length,
    okRuns: okResults.length,
    failedRuns: errors,
    generatedAt: (opts.generatedAt ?? new Date()).toISOString(),
    presetsOrder,
    perPreset,
    crux: cruxShape,
    labVsField,
    weightedVerdict,
    cwvGate,
    reasoning,
  };
}

/**
 * Reads the Astro-built static report template (web/dist/r/index.html) and
 * splices in a `<script>window.__PSI_DATA__ = {...}</script>` right after
 * the opening <body> tag. The template handles all rendering via the React
 * `StaticReport` component, which reads from window.__PSI_DATA__ on mount.
 */
export function renderHtmlReport(opts: HtmlReportOptions): string {
  const template = readFileSync(findTemplate(), 'utf-8');
  const data = buildPsiData(opts);
  // Safe JSON for inline <script>: escape </ to prevent premature termination.
  const json = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');
  const inject = `<script>window.__PSI_DATA__ = ${json};</script>`;
  // Inject right after the first <body...> tag.
  return template.replace(/<body([^>]*)>/i, `<body$1>${inject}`);
}
