'use client';

import type { HistoryPoint, SortMode, StoredState, TrackedDomain } from './types';

const STORAGE_KEY = 'drank:v1';

export function normalizeDomain(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;

  // Prepend protocol if missing so URL() works
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }

  try {
    const url = new URL(s);
    let host = url.hostname;

    // Strip www.
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }

    // Basic sanity: must have a dot and reasonable length
    if (!host?.includes('.') || host.length < 4 || host.length > 253) {
      return null;
    }

    // Disallow weird chars in hostname for this use-case
    if (!/^[a-z0-9.-]+$/.test(host)) {
      return null;
    }

    return host;
  } catch {
    return null;
  }
}

export async function fetchDomainRating(
  domain: string
): Promise<{ dr: number; fetchedAt: number } | { error: string }> {
  try {
    const res = await fetch(`/api/dr?target=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        return { error: body?.error || 'Rate limited. Please wait ~60 seconds.' };
      }
      return { error: body?.error || `Request failed (${res.status})` };
    }

    const data = await res.json();
    if (typeof data?.dr === 'number') {
      return { dr: data.dr, fetchedAt: data.fetchedAt || Date.now() };
    }
    return { error: 'Unexpected response shape' };
  } catch (_e) {
    return { error: 'Network error. Check your connection.' };
  }
}

export function getCurrentDR(d: TrackedDomain): number | null {
  if (d.history.length === 0) return null;
  return d.history[d.history.length - 1].dr;
}

export function getTrend(
  d: TrackedDomain
): { delta: number; direction: 'up' | 'down' | 'flat' } | null {
  if (d.history.length < 2) return null;
  const prev = d.history[d.history.length - 2].dr;
  const curr = d.history[d.history.length - 1].dr;
  // Round to one decimal — DR is a 0-100 float and raw subtraction leaks
  // artifacts like +0.10000000000000853 into the UI
  const delta = Number((curr - prev).toFixed(1));
  if (delta > 0) return { delta, direction: 'up' };
  if (delta < 0) return { delta, direction: 'down' };
  return { delta: 0, direction: 'flat' };
}

export function formatRelativeTime(ts: number | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  return `${week}w ago`;
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ts));
}

export function getDRColor(dr: number | null): { text: string; bg: string; border: string } {
  if (dr === null) return { text: 'text-zinc-400', bg: 'bg-zinc-100', border: 'border-zinc-200' };
  if (dr >= 90)
    return { text: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' };
  if (dr >= 70) return { text: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200' };
  if (dr >= 50) return { text: 'text-lime-700', bg: 'bg-lime-100', border: 'border-lime-200' };
  if (dr >= 30)
    return { text: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200' };
  if (dr >= 10)
    return { text: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' };
  return { text: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' };
}

export function getDRBarColor(dr: number | null): string {
  if (dr === null) return '#d4d4d8'; // zinc-300
  if (dr >= 90) return '#10b981'; // emerald-500
  if (dr >= 70) return '#22c55e'; // green-500
  if (dr >= 50) return '#84cc16'; // lime-500
  if (dr >= 30) return '#eab308'; // yellow-500
  if (dr >= 10) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

export function calculateStats(domains: TrackedDomain[]) {
  const withDR = domains.map(getCurrentDR).filter((d): d is number => d !== null);

  const count = domains.length;
  const avg =
    withDR.length > 0
      ? Number((withDR.reduce((a, b) => a + b, 0) / withDR.length).toFixed(1))
      : null;
  const max = withDR.length > 0 ? Math.max(...withDR) : null;

  const totalMeasurements = domains.reduce((sum, d) => sum + d.history.length, 0);

  return { count, avg, max, totalMeasurements };
}

export function sortDomains(domains: TrackedDomain[], mode: SortMode): TrackedDomain[] {
  const copy = [...domains];

  const getDR = (d: TrackedDomain) => getCurrentDR(d) ?? -1;

  switch (mode) {
    case 'dr-desc':
      return copy.sort((a, b) => getDR(b) - getDR(a));
    case 'dr-asc':
      return copy.sort((a, b) => getDR(a) - getDR(b));
    case 'name-asc':
      return copy.sort((a, b) => a.domain.localeCompare(b.domain));
    case 'name-desc':
      return copy.sort((a, b) => b.domain.localeCompare(a.domain));
    case 'updated-desc':
      return copy.sort((a, b) => (b.lastChecked ?? 0) - (a.lastChecked ?? 0));
    case 'updated-asc':
      return copy.sort((a, b) => (a.lastChecked ?? 0) - (b.lastChecked ?? 0));
    case 'trend-desc': {
      return copy.sort((a, b) => {
        const ta = getTrend(a);
        const tb = getTrend(b);
        const da = ta ? ta.delta : -Infinity;
        const db = tb ? tb.delta : -Infinity;
        return db - da;
      });
    }
    default:
      return copy;
  }
}

export function loadState(): StoredState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.version === 1 || parsed.version === 2) && Array.isArray(parsed.domains)) {
      return parsed as StoredState;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveState(state: StoredState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or private mode — ignore silently
  }
}

export function exportState(state: StoredState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drank-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importState(file: File): Promise<StoredState | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (
          parsed &&
          (parsed.version === 1 || parsed.version === 2) &&
          Array.isArray(parsed.domains)
        ) {
          resolve(parsed as StoredState);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

// Small pure SVG sparkline (no extra deps in table rows)
export function Sparkline({
  history,
  width = 72,
  height = 28,
}: {
  history: HistoryPoint[];
  width?: number;
  height?: number;
}) {
  if (history.length < 2) {
    return (
      <div className="flex h-7 w-[72px] items-center justify-center text-[10px] text-zinc-400">
        —
      </div>
    );
  }

  const values = history.map((h) => h.dr);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = Math.max(max - min, 1);

  const points = history
    .map((h, i) => {
      const x = (i / (history.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((h.dr - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .join(' ');

  const color = getDRBarColor(values[values.length - 1]);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* last point dot */}
      {(() => {
        const lastIdx = history.length - 1;
        const x = (lastIdx / (history.length - 1)) * (width - 4) + 2;
        const y = height - 2 - ((history[lastIdx].dr - min) / range) * (height - 4);
        return <circle cx={x} cy={y} r="2" fill={color} />;
      })()}
    </svg>
  );
}

// =====================
// NEW HELPERS FOR BEAUTIFUL DASHBOARD + AUTO
// =====================

export function getFaviconUrl(domain: string): string {
  // Public Google favicon service — reliable for this kind of dashboard, no key needed
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

export function getWeeklyChange(
  domain: TrackedDomain
): { delta: number; direction: 'up' | 'down' | 'flat' } | null {
  if (domain.history.length < 2) return null;

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Find the most recent point before or around a week ago, and the latest
  const sorted = [...domain.history].sort((a, b) => a.ts - b.ts);
  const latest = sorted[sorted.length - 1];

  // Find the closest point that is at least ~5 days old (to have meaningful "weekly")
  let base: HistoryPoint | null = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].ts <= weekAgo + 2 * 24 * 60 * 60 * 1000) {
      base = sorted[i];
      break;
    }
  }
  if (!base) base = sorted[0];

  const delta = Number((latest.dr - base.dr).toFixed(1));
  if (delta > 0) return { delta, direction: 'up' };
  if (delta < 0) return { delta, direction: 'down' };
  return { delta: 0, direction: 'flat' };
}

export function getNextAutoRefreshDate(lastAuto: number | null, enabled: boolean): Date | null {
  if (!enabled) return null;
  if (lastAuto == null) return null;
  return new Date(lastAuto + 7 * 24 * 60 * 60 * 1000);
}

export function formatNextAuto(lastAuto: number | null, enabled: boolean): string {
  if (!enabled) return 'Auto-refresh off';
  if (lastAuto == null) return 'Will run on next visit';
  const next = getNextAutoRefreshDate(lastAuto, enabled);
  if (!next) return 'Auto-refresh on';
  const diff = next.getTime() - Date.now();
  if (diff <= 0) return 'Due now (will run on next visit)';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days >= 1) return `Next in ~${days}d`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `Next in ~${hours}h`;
}

export function computeGainersLosers(domains: TrackedDomain[]) {
  const changes = domains
    .map((d) => {
      const ch = getWeeklyChange(d);
      return ch ? { domain: d.domain, ...ch } : null;
    })
    .filter(Boolean) as Array<{ domain: string; delta: number; direction: 'up' | 'down' | 'flat' }>;

  const gainers = changes
    .filter((c) => c.direction === 'up')
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
  const losers = changes
    .filter((c) => c.direction === 'down')
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  return { gainers, losers };
}
