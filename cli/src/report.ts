import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import type { RunResult } from './runner.js';
import { computeStats, type Stats } from './stats.js';

type MetricKey =
  | 'lcp'
  | 'inp'
  | 'cls'
  | 'tbt'
  | 'fcp'
  | 'ttfb'
  | 'si'
  | 'performance_score';

interface MetricSpec {
  key: MetricKey;
  label: string;
  unit: 'ms' | 'score' | 'index';
  good?: number;
  poor?: number;
  higherIsBetter?: boolean;
}

const METRICS: MetricSpec[] = [
  {
    key: 'performance_score',
    label: 'Perf Score',
    unit: 'score',
    good: 90,
    poor: 50,
    higherIsBetter: true,
  },
  { key: 'lcp', label: 'LCP', unit: 'ms', good: 2500, poor: 4000 },
  { key: 'inp', label: 'INP', unit: 'ms', good: 200, poor: 500 },
  { key: 'cls', label: 'CLS', unit: 'index', good: 0.1, poor: 0.25 },
  { key: 'tbt', label: 'TBT', unit: 'ms', good: 200, poor: 600 },
  { key: 'fcp', label: 'FCP', unit: 'ms', good: 1800, poor: 3000 },
  { key: 'ttfb', label: 'TTFB', unit: 'ms', good: 800, poor: 1800 },
  { key: 'si', label: 'SI', unit: 'ms', good: 3400, poor: 5800 },
];

function fmt(v: number, unit: MetricSpec['unit']): string {
  if (!Number.isFinite(v)) return '—';
  if (unit === 'ms') {
    if (v >= 1000) return `${(v / 1000).toFixed(2)}s`;
    return `${Math.round(v)}ms`;
  }
  if (unit === 'index') return v.toFixed(3);
  return v.toFixed(0);
}

function color(v: number, spec: MetricSpec): (s: string) => string {
  if (!Number.isFinite(v)) return chalk.dim;
  const good = spec.good ?? 0;
  const poor = spec.poor ?? Infinity;
  if (spec.higherIsBetter) {
    if (v >= good) return chalk.green;
    if (v >= (poor + good) / 2) return chalk.yellow;
    return chalk.red;
  }
  if (v <= good) return chalk.green;
  if (v <= poor) return chalk.yellow;
  return chalk.red;
}

type ColumnsByMetric = Record<string, Stats | null>;

function statsByMetric(results: RunResult[]): ColumnsByMetric {
  const out: ColumnsByMetric = {};
  for (const m of METRICS) {
    const vals = results
      .map((r) => r.metrics?.[m.key])
      .filter((v): v is number => typeof v === 'number');
    out[m.key] = computeStats(vals);
  }
  return out;
}

function presetTable(label: string, stats: ColumnsByMetric): string {
  const table = new Table({
    head: [
      chalk.bold('Metric'),
      chalk.bold('p50'),
      chalk.bold('p75'),
      chalk.bold('p90'),
      chalk.bold('p99'),
      chalk.bold('min'),
      chalk.bold('max'),
      chalk.bold('σ'),
    ],
    style: { head: [], border: ['gray'] },
  });
  for (const m of METRICS) {
    const s = stats[m.key];
    // Skip rows with no data — typical for INP in lab mode.
    if (!s) continue;
    const c = (v: number) => color(v, m)(fmt(v, m.unit));
    table.push([
      chalk.bold(m.label),
      c(s.p50),
      c(s.p75),
      c(s.p90),
      c(s.p99),
      chalk.dim(fmt(s.min, m.unit)),
      chalk.dim(fmt(s.max, m.unit)),
      chalk.dim(fmt(s.stddev, m.unit)),
    ]);
  }
  return chalk.cyan.bold(label) + '\n' + table.toString();
}

function sparkline(values: number[], width = 32): string {
  if (values.length === 0) return '';
  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = Math.max(1, Math.floor(values.length / width));
  const buckets: number[] = [];
  for (let i = 0; i < values.length; i += bucketSize) {
    const slice = values.slice(i, i + bucketSize);
    buckets.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return buckets
    .map((v) => {
      const idx = Math.min(
        chars.length - 1,
        Math.floor(((v - min) / range) * (chars.length - 1)),
      );
      return chars[idx];
    })
    .join('');
}

function distributionStrip(results: RunResult[]): string {
  const lcps = results
    .map((r) => r.metrics?.lcp)
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => a - b);
  if (lcps.length === 0) return '';
  return (
    chalk.dim('LCP shape: ') +
    chalk.cyan(sparkline(lcps, 32)) +
    chalk.dim(`  ${fmt(lcps[0], 'ms')} → ${fmt(lcps[lcps.length - 1], 'ms')}`)
  );
}

function overallVerdict(allResults: RunResult[]): string {
  const lcps = allResults
    .map((r) => r.metrics?.lcp)
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => a - b);
  if (lcps.length === 0) return '';
  const p75 = lcps[Math.floor(0.75 * (lcps.length - 1))];
  const verdict =
    p75 <= 2500
      ? chalk.green('GOOD')
      : p75 <= 4000
      ? chalk.yellow('NEEDS WORK')
      : chalk.red('POOR');
  return (
    chalk.dim('CWV LCP gate (p75 ≤ 2.5s): ') +
    verdict +
    chalk.dim(`  observed p75 = ${fmt(p75, 'ms')}`)
  );
}

export function renderSwarmReport(
  url: string,
  results: RunResult[],
  elapsedMs: number,
): string {
  const okResults = results.filter((r) => !r.error);
  const errors = results.length - okResults.length;
  const byPreset = new Map<string, RunResult[]>();
  for (const r of okResults) {
    const arr = byPreset.get(r.preset.name) ?? [];
    arr.push(r);
    byPreset.set(r.preset.name, arr);
  }

  const headerLines: string[] = [
    chalk.bold('psi-swarm report'),
    '',
    chalk.dim('URL:      ') + url,
    chalk.dim('Runs:     ') +
      `${results.length} (${chalk.green(`${okResults.length} ok`)}${
        errors ? ', ' + chalk.red(`${errors} failed`) : ''
      })`,
    chalk.dim('Presets:  ') + Array.from(byPreset.keys()).join(', '),
    chalk.dim('Elapsed:  ') + `${(elapsedMs / 1000).toFixed(1)}s`,
  ];

  const sections: string[] = [
    boxen(headerLines.join('\n'), {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    }),
  ];

  for (const [presetName, rs] of byPreset) {
    const label = rs[0].preset.label;
    const stats = statsByMetric(rs);
    sections.push(
      presetTable(`${presetName}  ·  ${label}  ·  n=${rs.length}`, stats),
    );
    const strip = distributionStrip(rs);
    if (strip) sections.push(strip);
  }

  const verdict = overallVerdict(okResults);
  if (verdict) sections.push(verdict);

  sections.push(
    chalk.dim(
      [
        '',
        'Notes:',
        '  • LAB data (emulated network + CPU). Real-user p99 is dominated by device/network',
        '    variance you cannot reproduce locally — use CrUX or a RUM tool for that.',
        '  • INP requires real user input and is not measured in navigation mode (row is hidden).',
        '  • Thresholds = Core Web Vitals "good"/"needs improvement"/"poor" bands.',
      ].join('\n'),
    ),
  );

  return sections.join('\n\n');
}
