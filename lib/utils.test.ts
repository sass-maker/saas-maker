import { describe, expect, it } from 'vitest';
import {
  calculateStats,
  computeGainersLosers,
  formatNextAuto,
  formatRelativeTime,
  getCurrentDR,
  getDRBarColor,
  getDRColor,
  getFaviconUrl,
  getNextAutoRefreshDate,
  getTrend,
  getWeeklyChange,
  normalizeDomain,
  sortDomains,
} from './utils';
import type { TrackedDomain } from './types';

describe('normalizeDomain', () => {
  it('strips protocol and www.', () => {
    expect(normalizeDomain('https://www.example.com')).toBe('example.com');
  });

  it('lowercases and trims', () => {
    expect(normalizeDomain('  Example.COM  ')).toBe('example.com');
  });

  it('returns null for invalid input', () => {
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('not-a-domain')).toBeNull();
    expect(normalizeDomain('localhost')).toBeNull();
  });
});

describe('getCurrentDR / getTrend', () => {
  const d: TrackedDomain = {
    domain: 'example.com',
    history: [
      { dr: 50, ts: 1 },
      { dr: 55, ts: 2 },
    ],
    lastChecked: 2,
  } as TrackedDomain;

  it('returns latest DR', () => {
    expect(getCurrentDR(d)).toBe(55);
  });

  it('computes trend delta', () => {
    expect(getTrend(d)).toEqual({ delta: 5, direction: 'up' });
  });

  it('returns null trend for <2 points', () => {
    expect(getTrend({ ...d, history: [{ dr: 50, ts: 1 }] })).toBeNull();
  });
});

describe('getDRColor / getDRBarColor', () => {
  it('returns neutral for null', () => {
    expect(getDRColor(null).text).toBe('text-zinc-400');
    expect(getDRBarColor(null)).toBe('#d4d4d8');
  });

  it('returns emerald for >=90', () => {
    expect(getDRColor(95).text).toBe('text-emerald-700');
    expect(getDRBarColor(95)).toBe('#10b981');
  });
});

describe('calculateStats', () => {
  it('handles empty list', () => {
    expect(calculateStats([])).toEqual({ count: 0, avg: null, max: null, totalMeasurements: 0 });
  });
});

describe('sortDomains', () => {
  const domains: TrackedDomain[] = [
    { domain: 'b.com', history: [{ dr: 30, ts: 1 }], lastChecked: 1 } as TrackedDomain,
    { domain: 'a.com', history: [{ dr: 80, ts: 1 }], lastChecked: 2 } as TrackedDomain,
  ];

  it('sorts by dr-desc', () => {
    const sorted = sortDomains(domains, 'dr-desc');
    expect(sorted[0].domain).toBe('a.com');
  });

  it('sorts by name-asc', () => {
    const sorted = sortDomains(domains, 'name-asc');
    expect(sorted[0].domain).toBe('a.com');
  });
});

describe('formatRelativeTime', () => {
  it("returns 'never' for null", () => {
    expect(formatRelativeTime(null)).toBe('never');
  });

  it("returns 'just now' for recent", () => {
    expect(formatRelativeTime(Date.now() - 1000)).toBe('just now');
  });
});

describe('getFaviconUrl', () => {
  it('encodes the domain', () => {
    expect(getFaviconUrl('ex ample.com')).toContain('ex%20ample.com');
  });
});

describe('getNextAutoRefreshDate / formatNextAuto', () => {
  it('returns null when disabled', () => {
    expect(getNextAutoRefreshDate(123, false)).toBeNull();
    expect(formatNextAuto(123, false)).toBe('Auto-refresh off');
  });

  it('returns null when no lastAuto', () => {
    expect(getNextAutoRefreshDate(null, true)).toBeNull();
    expect(formatNextAuto(null, true)).toBe('Will run on next visit');
  });
});

describe('getWeeklyChange / computeGainersLosers', () => {
  const now = Date.now();
  const d: TrackedDomain = {
    domain: 'example.com',
    history: [
      { dr: 50, ts: now - 8 * 24 * 60 * 60 * 1000 },
      { dr: 60, ts: now },
    ],
    lastChecked: now,
  } as TrackedDomain;

  it('computes weekly change', () => {
    expect(getWeeklyChange(d)?.delta).toBe(10);
  });

  it('computes gainers/losers', () => {
    const { gainers, losers } = computeGainersLosers([d]);
    expect(gainers).toHaveLength(1);
    expect(losers).toHaveLength(0);
  });
});
