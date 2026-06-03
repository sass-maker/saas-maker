import { useEffect, useState } from 'react';

// All the data the report needs, pre-baked at CLI time.
export interface PsiReportData {
  url: string;
  elapsedMs: number;
  runsCount: number;
  okRuns: number;
  failedRuns: number;
  generatedAt: string;
  presetsOrder: string[];
  perPreset: Record<
    string,
    {
      label: string;
      formFactor: 'mobile' | 'desktop';
      n: number;
      stats: Record<string, Stats | null>;
      lcpElement?: { snippet?: string; selector?: string; nodeLabel?: string };
      lcpPhases?: Array<{ phase: string; medianMs: number; percent: string }>;
      topOpportunities: Array<{
        label: string;
        display: string;
        savings: string;
        affects: string;
        topItems: Array<{ label: string; detail?: string }>;
      }>;
    }
  >;
  crux?: {
    mobile?: CruxData | null;
    desktop?: CruxData | null;
  };
  labVsField?: Array<{
    formFactor: 'mobile' | 'desktop';
    labP75Ms: number;
    fieldP75Ms: number;
    ratio: number;
    verdictKind: 'matches' | 'pessimistic' | 'optimistic';
  }>;
  weightedVerdict?: {
    profile: string;
    breakdown: string;
    metrics: Array<{ label: string; value: string; tier: 'good' | 'warn' | 'poor' | 'dim' }>;
  };
  cwvGate?: { tier: 'good' | 'warn' | 'poor'; p75Ms: number };
  reasoning?: { text: string; backend: string; model?: string; durationMs?: number };
}

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

export interface CruxData {
  source: 'origin' | 'url';
  collectionPeriod?: string;
  metrics: {
    lcp?: { p75: number };
    cls?: { p75: number };
    inp?: { p75: number };
    fcp?: { p75: number };
    ttfb?: { p75: number };
  };
}

type MetricKey = 'lcp' | 'cls' | 'inp' | 'tbt' | 'fcp' | 'ttfb' | 'si' | 'performance_score';
interface MetricSpec {
  key: MetricKey;
  label: string;
  unit: 'ms' | 'index' | 'score';
  good?: number;
  poor?: number;
  higherIsBetter?: boolean;
}

const METRICS: MetricSpec[] = [
  { key: 'performance_score', label: 'Perf Score', unit: 'score', good: 90, poor: 50, higherIsBetter: true },
  { key: 'lcp', label: 'LCP', unit: 'ms', good: 2500, poor: 4000 },
  { key: 'inp', label: 'INP', unit: 'ms', good: 200, poor: 500 },
  { key: 'cls', label: 'CLS', unit: 'index', good: 0.1, poor: 0.25 },
  { key: 'tbt', label: 'TBT', unit: 'ms', good: 200, poor: 600 },
  { key: 'fcp', label: 'FCP', unit: 'ms', good: 1800, poor: 3000 },
  { key: 'ttfb', label: 'TTFB', unit: 'ms', good: 800, poor: 1800 },
  { key: 'si', label: 'SI', unit: 'ms', good: 3400, poor: 5800 },
];

function fmt(v: number | undefined, unit: 'ms' | 'index' | 'score'): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  if (unit === 'ms') return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`;
  if (unit === 'index') return v.toFixed(3);
  return v.toFixed(0);
}

function tierClass(v: number | undefined, spec: { good?: number; poor?: number; higherIsBetter?: boolean }): string {
  if (v === undefined || !Number.isFinite(v)) return 'text-[var(--color-dim)]';
  if (spec.higherIsBetter) {
    if (v >= (spec.good ?? 0)) return 'text-[var(--color-good)]';
    if (v >= ((spec.poor ?? 0) + (spec.good ?? 0)) / 2) return 'text-[var(--color-warn)]';
    return 'text-[var(--color-poor)]';
  }
  if (v <= (spec.good ?? 0)) return 'text-[var(--color-good)]';
  if (v <= (spec.poor ?? Infinity)) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-poor)]';
}

const tierToClass = (tier: 'good' | 'warn' | 'poor' | 'dim') => ({
  good: 'text-[var(--color-good)]',
  warn: 'text-[var(--color-warn)]',
  poor: 'text-[var(--color-poor)]',
  dim: 'text-[var(--color-dim)]',
}[tier]);

declare global {
  interface Window {
    __PSI_DATA__?: PsiReportData;
  }
}

export default function StaticReport({ data: dataProp }: { data?: PsiReportData }) {
  const [data, setData] = useState<PsiReportData | undefined>(dataProp);
  useEffect(() => {
    if (!data && typeof window !== 'undefined' && window.__PSI_DATA__) {
      setData(window.__PSI_DATA__);
    }
  }, [data]);

  if (!data) {
    return (
      <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg p-8 text-center">
        <p className="text-[var(--color-dim)]">No report data found. Expected <code className="font-mono text-[var(--color-cyan)]">window.__PSI_DATA__</code> to be set.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header data={data} />
      {data.presetsOrder.map((name) => {
        const p = data.perPreset[name];
        if (!p) return null;
        return <PresetTable key={name} name={name} preset={p} />;
      })}
      {data.cwvGate && (
        <Verdict
          label="CWV LCP gate (p75 ≤ 2.5s)"
          tier={data.cwvGate.tier}
          text={fmt(data.cwvGate.p75Ms, 'ms')}
        />
      )}
      {data.weightedVerdict && <WeightedVerdict v={data.weightedVerdict} />}
      {data.crux && (data.crux.mobile || data.crux.desktop) && <CruxTable crux={data.crux} />}
      {data.labVsField && data.labVsField.length > 0 && <LabFieldGapView gap={data.labVsField} />}
      {data.presetsOrder.map((name) => {
        const p = data.perPreset[name];
        if (!p) return null;
        return <WhySection key={`why-${name}`} name={name} preset={p} />;
      })}
      {data.reasoning && data.reasoning.text && <ReasoningSection r={data.reasoning} />}
      <Footer />
    </div>
  );
}

function Header({ data }: { data: PsiReportData }) {
  return (
    <header className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg p-5">
      <h1 className="text-2xl font-bold tracking-tight">
        <span className="text-[var(--color-cyan)]">psi</span>-swarm report
      </h1>
      <div className="text-sm text-[var(--color-dim)] mt-1 break-all">{data.url}</div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-[var(--color-dim)]">
        <div><span>Runs:</span> <span className="text-[var(--color-text)]">{data.runsCount} ({data.okRuns} ok{data.failedRuns ? `, ${data.failedRuns} failed` : ''})</span></div>
        <div><span>Presets:</span> <span className="text-[var(--color-text)]">{data.presetsOrder.join(', ')}</span></div>
        <div><span>Elapsed:</span> <span className="text-[var(--color-text)]">{(data.elapsedMs / 1000).toFixed(1)}s</span></div>
        <div><span>Generated:</span> <span className="font-mono">{data.generatedAt}</span></div>
      </div>
    </header>
  );
}

function PresetTable({ name, preset }: { name: string; preset: PsiReportData['perPreset'][string] }) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-baseline justify-between">
        <div>
          <span className="inline-block px-2 py-0.5 mr-2 rounded text-xs font-medium bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]">{name}</span>
          <span className="text-[var(--color-dim)] text-sm">{preset.label}</span>
        </div>
        <span className="text-[var(--color-dim)] text-xs font-mono">n = {preset.n}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--color-dim)] text-xs uppercase tracking-wide">
            <th className="text-left py-2 px-4">Metric</th>
            <th className="text-right py-2 px-3">p50</th>
            <th className="text-right py-2 px-3">p75</th>
            <th className="text-right py-2 px-3">p90</th>
            <th className="text-right py-2 px-3">p99</th>
            <th className="text-right py-2 px-3">min</th>
            <th className="text-right py-2 px-3">max</th>
            <th className="text-right py-2 px-3">σ</th>
          </tr>
        </thead>
        <tbody>
          {METRICS.map((m) => {
            const s = preset.stats[m.key];
            if (!s) return null;
            const cls = (v: number) => `text-right py-1.5 px-3 font-mono ${tierClass(v, m)}`;
            return (
              <tr key={m.key} className="border-t border-[var(--color-border)]">
                <td className="py-1.5 px-4 font-medium">{m.label}</td>
                <td className={cls(s.p50)}>{fmt(s.p50, m.unit)}</td>
                <td className={cls(s.p75)}>{fmt(s.p75, m.unit)}</td>
                <td className={cls(s.p90)}>{fmt(s.p90, m.unit)}</td>
                <td className={cls(s.p99)}>{fmt(s.p99, m.unit)}</td>
                <td className="text-right py-1.5 px-3 font-mono text-[var(--color-dim)]">{fmt(s.min, m.unit)}</td>
                <td className="text-right py-1.5 px-3 font-mono text-[var(--color-dim)]">{fmt(s.max, m.unit)}</td>
                <td className="text-right py-1.5 px-3 font-mono text-[var(--color-dim)]">{fmt(s.stddev, m.unit)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Verdict({ label, tier, text }: { label: string; tier: 'good' | 'warn' | 'poor'; text: string }) {
  const badgeBg = { good: 'bg-[var(--color-good)]/15', warn: 'bg-[var(--color-warn)]/15', poor: 'bg-[var(--color-poor)]/15' }[tier];
  const badgeText = { good: 'GOOD', warn: 'NEEDS WORK', poor: 'POOR' }[tier];
  return (
    <div className="text-sm flex items-center gap-3">
      <span className="text-[var(--color-dim)]">{label}:</span>
      <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold ${badgeBg} ${tierToClass(tier)}`}>{badgeText}</span>
      <span className="text-[var(--color-dim)]">observed p75 = </span>
      <span className="font-mono">{text}</span>
    </div>
  );
}

function WeightedVerdict({ v }: { v: NonNullable<PsiReportData['weightedVerdict']> }) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg px-5 py-4">
      <div className="text-sm font-semibold text-[var(--color-cyan)]">Weighted verdict ({v.profile})</div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
        {v.metrics.map((m) => (
          <div key={m.label}><span className="text-[var(--color-dim)]">{m.label}</span> <span className={`font-mono ${tierToClass(m.tier)}`}>{m.value}</span></div>
        ))}
      </div>
      <div className="text-xs text-[var(--color-dim)] mt-2">profile: {v.breakdown}</div>
    </div>
  );
}

function CruxTable({ crux }: { crux: NonNullable<PsiReportData['crux']> }) {
  const row = (label: string, rec?: CruxData | null) => {
    if (!rec) return (
      <tr><td className="py-2 px-4 text-[var(--color-dim)]">{label}</td><td colSpan={5} className="py-2 px-3 text-[var(--color-dim)] text-sm">no data</td></tr>
    );
    const cell = (v: number | undefined, spec: { good: number; poor: number; unit: 'ms' | 'index' }) => (
      <td className={`text-right py-2 px-3 font-mono ${tierClass(v, spec)}`}>{fmt(v, spec.unit)}</td>
    );
    return (
      <tr key={label}>
        <td className="py-2 px-4">{label}</td>
        {cell(rec.metrics.lcp?.p75, { good: 2500, poor: 4000, unit: 'ms' })}
        {cell(rec.metrics.cls?.p75, { good: 0.1, poor: 0.25, unit: 'index' })}
        {cell(rec.metrics.inp?.p75, { good: 200, poor: 500, unit: 'ms' })}
        {cell(rec.metrics.fcp?.p75, { good: 1800, poor: 3000, unit: 'ms' })}
        {cell(rec.metrics.ttfb?.p75, { good: 800, poor: 1800, unit: 'ms' })}
      </tr>
    );
  };
  const period = crux.mobile?.collectionPeriod ?? crux.desktop?.collectionPeriod;
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <div className="font-semibold text-[var(--color-cyan)]">Real users (CrUX p75)</div>
        <div className="text-xs text-[var(--color-dim)] mt-0.5">28-day field data from Chrome{period ? ` · ${period}` : ''}</div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[var(--color-dim)] text-xs uppercase tracking-wide">
            <th className="text-left py-2 px-4">Form factor</th>
            <th className="text-right py-2 px-3">LCP</th>
            <th className="text-right py-2 px-3">CLS</th>
            <th className="text-right py-2 px-3">INP</th>
            <th className="text-right py-2 px-3">FCP</th>
            <th className="text-right py-2 px-3">TTFB</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {row('mobile (PHONE)', crux.mobile)}
          {row('desktop', crux.desktop)}
        </tbody>
      </table>
    </div>
  );
}

function LabFieldGapView({ gap }: { gap: NonNullable<PsiReportData['labVsField']> }) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg px-5 py-4">
      <div className="text-sm font-semibold text-[var(--color-cyan)] mb-2">Lab vs field gap</div>
      {gap.map((g) => {
        const ratioText = g.verdictKind === 'pessimistic'
          ? `lab is ${g.ratio.toFixed(1)}× more pessimistic`
          : g.verdictKind === 'optimistic'
          ? `lab is ${(1 / g.ratio).toFixed(1)}× more optimistic than reality`
          : 'lab matches reality (within ±50%)';
        const tier = g.verdictKind === 'pessimistic' ? 'warn' : g.verdictKind === 'optimistic' ? 'poor' : 'good';
        return (
          <div key={g.formFactor} className="text-sm mb-1">
            <span className="text-[var(--color-dim)] w-16 inline-block">{g.formFactor}</span>
            <span className="text-[var(--color-dim)]"> lab </span>
            <span className="font-mono font-semibold">{fmt(g.labP75Ms, 'ms')}</span>
            <span className="text-[var(--color-dim)]"> vs field </span>
            <span className="font-mono font-semibold">{fmt(g.fieldP75Ms, 'ms')}</span>
            <span className="text-[var(--color-dim)]"> → </span>
            <span className={tierToClass(tier)}>{ratioText}</span>
          </div>
        );
      })}
    </div>
  );
}

function WhySection({ name, preset }: { name: string; preset: PsiReportData['perPreset'][string] }) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg p-5">
      <h2 className="font-semibold mb-2">Why {name}?</h2>
      {preset.lcpElement && (
        <div className="mb-3">
          <div className="text-sm">
            <span className="text-[var(--color-dim)]">LCP element: </span>
            <span className="font-mono text-[var(--color-warn)]">{preset.lcpElement.nodeLabel ?? preset.lcpElement.selector ?? '(unknown)'}</span>
          </div>
          {preset.lcpElement.snippet && (
            <div className="ml-4 text-xs text-[var(--color-dim)] font-mono mt-0.5 break-all">{preset.lcpElement.snippet.slice(0, 220)}</div>
          )}
        </div>
      )}
      {preset.lcpPhases && preset.lcpPhases.length > 0 && (
        <div className="text-sm flex flex-wrap gap-x-4 gap-y-1 mb-3">
          <span className="text-[var(--color-dim)]">LCP phases:</span>
          {preset.lcpPhases.map((p) => {
            const pct = parseInt(p.percent, 10);
            const cls = pct >= 40 ? 'text-[var(--color-poor)]' : pct >= 25 ? 'text-[var(--color-warn)]' : 'text-[var(--color-dim)]';
            return (
              <span key={p.phase} className={`font-mono text-xs ${cls}`}>
                {p.phase} {p.percent} ({p.medianMs >= 1000 ? `${(p.medianMs / 1000).toFixed(1)}s` : `${Math.round(p.medianMs)}ms`})
              </span>
            );
          })}
        </div>
      )}
      {preset.topOpportunities.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--color-dim)] text-xs uppercase tracking-wide">
              <th className="text-left py-1.5">Opportunity</th>
              <th className="text-left py-1.5">Impact</th>
              <th className="text-left py-1.5">Top item</th>
            </tr>
          </thead>
          <tbody>
            {preset.topOpportunities.map((op, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="py-1.5 pr-3 font-medium">{op.label}</td>
                <td className="py-1.5 pr-3 font-mono text-xs text-[var(--color-warn)]">{op.savings || op.display || '—'}</td>
                <td className="py-1.5 font-mono text-xs text-[var(--color-dim)] break-all">
                  {op.topItems[0]?.label ?? '—'}
                  {op.topItems[0]?.detail && <span className="ml-1 text-[var(--color-dim)]">({op.topItems[0].detail})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ReasoningSection({ r }: { r: NonNullable<PsiReportData['reasoning']> }) {
  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-panel)] rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-baseline justify-between">
        <span className="font-semibold text-[var(--color-cyan)]">Reasoning</span>
        <span className="text-xs text-[var(--color-dim)] font-mono">
          {r.backend}{r.model ? ` · ${r.model}` : ''}{r.durationMs ? ` · ${(r.durationMs / 1000).toFixed(1)}s` : ''}
        </span>
      </div>
      <div className="px-5 py-4 bg-[var(--color-bg)] border-l-4 border-[var(--color-cyan)]">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.text}</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="text-center text-xs text-[var(--color-dim)] pt-8 pb-4">
      Generated by{' '}
      <a className="text-[var(--color-cyan)] hover:underline" href="https://github.com/sarthakagrawal927/psi-swarm">
        psi-swarm
      </a>
      {' · '}
      lab data is emulated network + CPU · for honest p99 use a RUM tool
    </footer>
  );
}
