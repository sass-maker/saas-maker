'use client';

import { AlertCircle, Lightbulb, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  drAdvisorMeasurementKey,
  parseDrAdvisorAdvice,
  parseDrAdvisorRequest,
  type CachedDrAdvisorAdvice,
  type DrAdvisorAdvice,
  type DrAdvisorRequest,
} from '@/lib/dr-advisor';

const CACHE_KEY = 'drank:advisor:v1';

function readCache(measurementKey: string): CachedDrAdvisorAdvice | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entries = JSON.parse(raw) as Record<string, unknown>;
    const entry = entries[measurementKey];
    if (!entry || typeof entry !== 'object') return null;
    const candidate = entry as Partial<CachedDrAdvisorAdvice>;
    if (candidate.measurementKey !== measurementKey || typeof candidate.generatedAt !== 'number') {
      return null;
    }
    return {
      measurementKey,
      generatedAt: candidate.generatedAt,
      advice: parseDrAdvisorAdvice(candidate.advice),
    };
  } catch {
    return null;
  }
}

function writeCache(entry: CachedDrAdvisorAdvice): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const entries = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    entries[entry.measurementKey] = entry;
    const boundedEntries = Object.fromEntries(Object.entries(entries).slice(-40));
    localStorage.setItem(CACHE_KEY, JSON.stringify(boundedEntries));
  } catch {
    // Advice remains usable for this session when storage is unavailable.
  }
}

export function DrAdvisor({ request }: { request: DrAdvisorRequest }) {
  const normalized = parseDrAdvisorRequest(request);
  const measurementKey = drAdvisorMeasurementKey(normalized);
  const [advice, setAdvice] = useState<DrAdvisorAdvice | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = readCache(measurementKey);
    setAdvice(cached?.advice ?? null);
    setGeneratedAt(cached?.generatedAt ?? null);
    setIsCached(Boolean(cached));
    setError(null);
  }, [measurementKey]);

  const generate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(normalized),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        advice?: unknown;
        generatedAt?: unknown;
        error?: unknown;
      };
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Advice is temporarily unavailable.'
        );
      }
      const nextAdvice = parseDrAdvisorAdvice(payload.advice);
      const nextGeneratedAt =
        typeof payload.generatedAt === 'number' ? payload.generatedAt : Date.now();
      const entry = { advice: nextAdvice, generatedAt: nextGeneratedAt, measurementKey };
      setAdvice(nextAdvice);
      setGeneratedAt(nextGeneratedAt);
      setIsCached(false);
      writeCache(entry);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Advice is temporarily unavailable.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Sparkles className="h-4 w-4" /> DR Advisor
          </div>
          <p className="mt-1 max-w-2xl text-xs text-white/50">
            Uses only the observed DR {normalized.currentDr.toFixed(1)}
            {normalized.trend.delta === null
              ? ' with no measured trend yet.'
              : ` and ${normalized.trend.delta >= 0 ? '+' : ''}${normalized.trend.delta.toFixed(1)} ${normalized.trend.direction} trend.`}{' '}
            It does not inspect backlinks or your site.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-950 disabled:opacity-60"
        >
          {isLoading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : advice ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Lightbulb className="h-3.5 w-3.5" />
          )}
          {isLoading ? 'Explaining…' : advice ? 'Regenerate' : 'Explain this DR'}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error} DR tracking and history are still available.</span>
        </div>
      )}

      {advice && (
        <div className="mt-5 space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-300/70">
              What the measurement suggests
            </div>
            <p className="mt-1 text-sm leading-6 text-white/80">{advice.why}</p>
          </div>
          <div className="rounded-xl bg-black/20 p-3 text-xs leading-5 text-white/50">
            <strong className="text-white/70">Evidence limit:</strong> {advice.evidenceLimit}
          </div>
          <ol className="space-y-2">
            {advice.actions.map((action) => (
              <li key={action.priority} className="flex gap-3 rounded-xl bg-white/5 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-xs font-bold text-emerald-950">
                  {action.priority}
                </span>
                <div>
                  <div className="text-sm font-medium text-white">{action.title}</div>
                  <div className="mt-0.5 text-xs leading-5 text-white/55">{action.reason}</div>
                </div>
              </li>
            ))}
          </ol>
          {generatedAt && (
            <div className="text-[10px] text-white/35">
              {isCached ? 'Loaded from this browser' : 'Generated now'} ·{' '}
              {new Date(generatedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
