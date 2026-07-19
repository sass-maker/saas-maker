export interface Stats {
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

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function computeStats(values: number[]): Stats | null {
  const xs = values
    .filter((v) => typeof v === 'number' && Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return {
    n,
    mean,
    stddev: Math.sqrt(variance),
    min: xs[0],
    max: xs[xs.length - 1],
    p50: percentile(xs, 50),
    p75: percentile(xs, 75),
    p90: percentile(xs, 90),
    p99: percentile(xs, 99),
  };
}
