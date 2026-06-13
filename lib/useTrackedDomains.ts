'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  exportState,
  fetchDomainRating,
  importState,
  loadState,
  normalizeDomain,
  saveState,
  sortDomains,
} from './utils';
import { HistoryPoint, SortMode, StoredState, Toast, TrackedDomain } from './types';
import globalSitesStatic from '@/data/global-sites.json';

const REFRESH_DELAY_MS = 750; // be polite to the free public endpoint
const GLOBAL_SITE_SET = new Set((globalSitesStatic as string[]).map((domain) => domain.toLowerCase()));

interface UseTrackedDomainsReturn {
  domains: TrackedDomain[];
  filteredAndSorted: TrackedDomain[];
  isLoading: boolean;
  updating: Set<string>;
  search: string;
  setSearch: (s: string) => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;

  addDomain: (input: string) => Promise<void>;
  refreshDomain: (domain: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  removeDomain: (domain: string) => void;
  clearAll: () => void;

  selectedDomain: string | null;
  selectDomain: (domain: string | null) => void;
  getDomain: (domain: string) => TrackedDomain | undefined;

  exportData: () => void;
  importData: (file: File) => Promise<boolean>;

  stats: { count: number; avg: number | null; max: number | null; totalMeasurements: number };

  // Weekly auto "cron" (client-opportunistic)
  autoRefreshEnabled: boolean;
  lastAutoRefresh: number | null;
  toggleAutoRefresh: (enabled: boolean) => void;
  runAutoRefreshNow: () => Promise<void>; // manual trigger for user's custom sites
  customCount: number; // number of user-added sites eligible for auto

  // "Predict the top" / submit contenders (local + shareable)
  predictions: import('./types').Prediction[];
  addPrediction: (domain: string, note?: string) => void;
  removePrediction: (domain: string) => void;
}

export function useTrackedDomains(): UseTrackedDomainsReturn {
  const [domains, setDomains] = useState<TrackedDomain[]>(() => {
    const stored = loadState();
    if (stored?.domains?.length) {
      return stored.domains.map((d) => ({
        ...d,
        isCustom: true,
      }));
    }
    return [];
  });
  const domainsRef = useRef<TrackedDomain[]>([]);
  const [lastGlobalRefresh, setLastGlobalRefresh] = useState<number | null>(() => loadState()?.lastGlobalRefresh ?? null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('dr-desc');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [isLoading] = useState(false);

  // Auto weekly refresh (client-side opportunistic cron for user custom sites)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => loadState()?.autoRefreshEnabled ?? true);
  const [lastAutoRefresh, setLastAutoRefresh] = useState<number | null>(() => loadState()?.lastAutoRefresh ?? null);

  // Predictions / "I think this will be at the top" submissions (localStorage only)
  const [predictions, setPredictions] = useState<import('./types').Prediction[]>(() => loadState()?.predictions || []);

  const toastIdRef = useRef(1);
  const autoRefreshInFlightRef = useRef(false);
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = toastIdRef.current++;
    setToasts((t) => [...t, { id, message, type }]);
    // auto dismiss
    setTimeout(() => {
      setToasts((current) => current.filter((tt) => tt.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((tt) => tt.id !== id));
  }, []);

  useEffect(() => {
    domainsRef.current = domains;
    const stored = loadState();
    if (!stored) {
      saveState({
        version: 2,
        domains: [],
        lastGlobalRefresh: null,
        autoRefreshEnabled: true,
        lastAutoRefresh: null,
        predictions: [],
      });
    }
  }, [domains]);

  // Persist with full v2 auto + predictions state
  const persist = useCallback((nextDomains: TrackedDomain[], nextLastGlobal?: number | null, nextPreds?: any) => {
    const state: StoredState = {
      version: 2,
      domains: nextDomains,
      lastGlobalRefresh: nextLastGlobal !== undefined ? nextLastGlobal : lastGlobalRefresh,
      autoRefreshEnabled,
      lastAutoRefresh,
      predictions: nextPreds !== undefined ? nextPreds : predictions,
    } as any;
    saveState(state);
  }, [lastGlobalRefresh, autoRefreshEnabled, lastAutoRefresh, predictions]);

  const updateDomains = useCallback((updater: (prev: TrackedDomain[]) => TrackedDomain[]) => {
    setDomains((prev) => {
      const next = updater(prev);
      domainsRef.current = next;
      persist(next);
      return next;
    });
  }, [persist]);

  const applyNewPoint = (domain: string, dr: number, fetchedAt: number) => {
    updateDomains((prev) =>
      prev.map((d) => {
        if (d.domain !== domain) return d;

        const point: HistoryPoint = { ts: fetchedAt, dr };
        // Avoid duplicate if same second (unlikely)
        const newHistory = [...d.history.filter((p) => p.ts !== point.ts), point].sort(
          (a, b) => a.ts - b.ts
        );

        return {
          ...d,
          history: newHistory,
          lastChecked: fetchedAt,
        };
      })
    );
  };

  const refreshDomain = useCallback(async (domain: string) => {
    setUpdating((u) => new Set(u).add(domain));

    const result = await fetchDomainRating(domain);

    setUpdating((u) => {
      const next = new Set(u);
      next.delete(domain);
      return next;
    });

    if ('error' in result) {
      showToast(`${domain}: ${result.error}`, 'error');
      return;
    }

    applyNewPoint(domain, result.dr, result.fetchedAt);
    // no toast on single success — too noisy for refresh all
  }, [showToast, updateDomains]);

  const addDomain = useCallback(async (input: string) => {
    const normalized = normalizeDomain(input);
    if (!normalized) {
      showToast('Please enter a valid domain (e.g. example.com)', 'error');
      return;
    }

    if (GLOBAL_SITE_SET.has(normalized)) {
      showToast(`${normalized} is already included in the shared examples`, 'info');
      return;
    }

    // If already tracked, just refresh it and select
    const existing = domains.find((d) => d.domain === normalized);
    if (existing) {
      showToast(`${normalized} is already tracked`, 'info');
      setSelectedDomain(normalized);
      await refreshDomain(normalized);
      return;
    }

    // Add immediately with empty history — mark as custom so it gets weekly auto love
    const newDomain: TrackedDomain = {
      domain: normalized,
      history: [],
      lastChecked: null,
      isCustom: true,
    };

    updateDomains((prev) => [...prev, newDomain]);
    // domainsRef is updated inside updateDomains
    showToast(`Added ${normalized}`, 'success');

    // Immediately fetch its rating
    await refreshDomain(normalized);
    setSelectedDomain(normalized);
  }, [domains, refreshDomain, updateDomains, showToast]);

  const refreshAll = useCallback(async () => {
    if (domains.length === 0) return;

    showToast(`Refreshing ${domains.length} domains... (this may take ~${Math.ceil((domains.length * REFRESH_DELAY_MS) / 1000)}s)`, 'info');

    const sorted = [...domains]; // current order is fine

    for (let i = 0; i < sorted.length; i++) {
      const d = sorted[i];
      setUpdating((u) => new Set(u).add(d.domain));

      // eslint-disable-next-line no-await-in-loop
      const result = await fetchDomainRating(d.domain);

      setUpdating((u) => {
        const next = new Set(u);
        next.delete(d.domain);
        return next;
      });

      if ('error' in result) {
        showToast(`${d.domain}: ${result.error}`, 'error');
      } else {
        applyNewPoint(d.domain, result.dr, result.fetchedAt);
      }

      // Pace requests
      if (i < sorted.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, REFRESH_DELAY_MS));
      }
    }

    const now = Date.now();
    setLastGlobalRefresh(now);
    // Use ref + current auto + predictions state
    persist(domainsRef.current, now, predictions);
    showToast('Refresh complete', 'success');
  }, [domains, persist, showToast]);

  const removeDomain = useCallback((domain: string) => {
    updateDomains((prev) => prev.filter((d) => d.domain !== domain));
    if (selectedDomain === domain) {
      setSelectedDomain(null);
    }
    showToast(`Removed ${domain}`, 'info');
  }, [updateDomains, selectedDomain, showToast]);

  const clearAll = useCallback(() => {
    if (!confirm('Clear all tracked domains and their history? This cannot be undone.')) return;
    const empty: TrackedDomain[] = [];
    setDomains(empty);
    domainsRef.current = empty;
    setLastGlobalRefresh(null);
    setLastAutoRefresh(null);
    setSelectedDomain(null);
    setPredictions([]);
    // Reset auto + predictions on full clear
    setAutoRefreshEnabled(true);
    saveState({
      version: 2,
      domains: empty,
      lastGlobalRefresh: null,
      autoRefreshEnabled: true,
      lastAutoRefresh: null,
      predictions: [],
    } as any);
    showToast('All data cleared', 'info');
  }, [persist, showToast]);

  const selectDomain = useCallback((domain: string | null) => {
    setSelectedDomain(domain);
  }, []);

  const getDomain = useCallback(
    (domain: string) => domains.find((d) => d.domain === domain),
    [domains]
  );

  // =====================
  // WEEKLY AUTO-REFRESH (client-side opportunistic "cron")
  // =====================
  const customCount = useMemo(
    () => domains.filter((d) => d.isCustom).length,
    [domains]
  );

  const runAutoRefreshNow = useCallback(async () => {
    if (autoRefreshInFlightRef.current) return;
    const customDomains = domainsRef.current.filter((d) => d.isCustom);
    if (customDomains.length === 0) {
      showToast('No custom sites to auto-refresh yet. Add your own domains.', 'info');
      return;
    }
    autoRefreshInFlightRef.current = true;

    showToast(`Auto-refreshing ${customDomains.length} of your sites...`, 'info');

    try {
      for (let i = 0; i < customDomains.length; i++) {
        const d = customDomains[i];
        setUpdating((u) => new Set(u).add(d.domain));

        // eslint-disable-next-line no-await-in-loop
        const result = await fetchDomainRating(d.domain);

        setUpdating((u) => {
          const next = new Set(u);
          next.delete(d.domain);
          return next;
        });

        if ('error' in result) {
          showToast(`${d.domain}: ${result.error}`, 'error');
        } else {
          applyNewPoint(d.domain, result.dr, result.fetchedAt);
        }

        if (i < customDomains.length - 1) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, REFRESH_DELAY_MS));
        }
      }

      const ts = Date.now();
      setLastAutoRefresh(ts);

      saveState({
        version: 2,
        domains: domainsRef.current,
        lastGlobalRefresh,
        autoRefreshEnabled,
        lastAutoRefresh: ts,
        predictions,
      });

      showToast('Weekly auto-refresh complete for your sites', 'success');
    } finally {
      autoRefreshInFlightRef.current = false;
    }
  }, [lastGlobalRefresh, autoRefreshEnabled, predictions, showToast]);

  const checkAndTriggerAuto = useCallback(async () => {
    if (!autoRefreshEnabled) return;

    const last = lastAutoRefresh;
    const now = Date.now();

    if (!last || now - last > WEEK_MS) {
      // Only run for sites the user actually cares about
      const hasCustom = domainsRef.current.some((d) => d.isCustom);
      if (!hasCustom) return;

      await runAutoRefreshNow();
    }
  }, [autoRefreshEnabled, lastAutoRefresh, runAutoRefreshNow]);

  // Trigger auto on mount (after hydrate), on tab visibility/focus, and light polling
  useEffect(() => {
    if (isLoading) return;
    const t = setTimeout(() => {
      checkAndTriggerAuto();
    }, 650);
    return () => clearTimeout(t);
  }, [isLoading, checkAndTriggerAuto]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkAndTriggerAuto();
      }
    };
    const onFocus = () => checkAndTriggerAuto();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkAndTriggerAuto]);

  // Light background check while the dashboard is open (every ~3 hours)
  useEffect(() => {
    const id = setInterval(() => {
      checkAndTriggerAuto();
    }, 3 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [checkAndTriggerAuto]);

  const toggleAutoRefresh = useCallback((enabled: boolean) => {
    setAutoRefreshEnabled(enabled);
    const currentDomains = domainsRef.current;
    saveState({
      version: 2,
      domains: currentDomains,
      lastGlobalRefresh,
      autoRefreshEnabled: enabled,
      lastAutoRefresh,
      predictions,
    });
    showToast(enabled ? 'Weekly auto-refresh enabled for your sites' : 'Weekly auto-refresh disabled', 'info');
  }, [lastGlobalRefresh, lastAutoRefresh, predictions, showToast]);

  // =====================
  // PREDICTIONS: "Submit websites you think will be at the top"
  // =====================
  const persistFullState = useCallback((nextDomains = domainsRef.current, extra: Partial<StoredState> = {}) => {
    const state: StoredState = {
      version: 2,
      domains: nextDomains,
      lastGlobalRefresh,
      autoRefreshEnabled,
      lastAutoRefresh,
      ...(extra as any),
    };
    saveState(state);
  }, [lastGlobalRefresh, autoRefreshEnabled, lastAutoRefresh]);

  const addPrediction = useCallback((domain: string, note?: string) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) {
      showToast('Invalid domain for prediction', 'error');
      return;
    }
    setPredictions((prev) => {
      if (prev.some((p) => p.domain === normalized)) {
        showToast('Already in your predictions', 'info');
        return prev;
      }
      const next = [...prev, { domain: normalized, note, addedAt: Date.now() }];
      // Persist together with other user data
      persistFullState(domainsRef.current, { predictions: next } as any);
      showToast(`Added ${normalized} to your top predictions`, 'success');
      return next;
    });
  }, [showToast, persistFullState]);

  const removePrediction = useCallback((domain: string) => {
    setPredictions((prev) => {
      const next = prev.filter((p) => p.domain !== domain);
      persistFullState(domainsRef.current, { predictions: next } as any);
      return next;
    });
  }, [persistFullState]);

  // =====================
  // END PREDICTIONS
  // =====================

  // =====================
  // END AUTO SECTION
  // =====================

  const exportData = useCallback(() => {
    const state: StoredState = {
      version: 2,
      domains,
      lastGlobalRefresh,
      autoRefreshEnabled,
      lastAutoRefresh,
      predictions,
    };
    exportState(state);
    showToast('Exported JSON', 'success');
  }, [domains, lastGlobalRefresh, autoRefreshEnabled, lastAutoRefresh, predictions, showToast]);

  const importData = useCallback(async (file: File): Promise<boolean> => {
    const parsed = await importState(file);
    if (!parsed) {
      showToast('Invalid or corrupted import file', 'error');
      return false;
    }

    const migrated = (parsed.domains || []).map((d: TrackedDomain) => ({
      ...d,
      isCustom: d.isCustom ?? true,
    }));

    setDomains(migrated);
    domainsRef.current = migrated;
    setLastGlobalRefresh(parsed.lastGlobalRefresh ?? null);
    setAutoRefreshEnabled(parsed.autoRefreshEnabled ?? true);
    setLastAutoRefresh(parsed.lastAutoRefresh ?? null);
    setSelectedDomain(null);
    const importedPreds = (parsed as any).predictions || [];
    setPredictions(importedPreds);

    saveState({
      version: 2,
      domains: migrated,
      lastGlobalRefresh: parsed.lastGlobalRefresh ?? null,
      autoRefreshEnabled: parsed.autoRefreshEnabled ?? true,
      lastAutoRefresh: parsed.lastAutoRefresh ?? null,
      predictions: importedPreds,
    } as any);

    showToast(`Imported ${migrated.length} domains`, 'success');
    return true;
  }, [showToast]);

  // Derived: filter + sort
  const filteredAndSorted = useMemo(() => {
    let result = domains;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((d) => d.domain.includes(q));
    }

    return sortDomains(result, sortMode);
  }, [domains, search, sortMode]);

  const stats = useMemo(() => {
    const withDR = domains
      .map((d) => (d.history.length > 0 ? d.history[d.history.length - 1].dr : null))
      .filter((n): n is number => n !== null);

    return {
      count: domains.length,
      avg: withDR.length ? Number((withDR.reduce((a, b) => a + b, 0) / withDR.length).toFixed(1)) : null,
      max: withDR.length ? Math.max(...withDR) : null,
      totalMeasurements: domains.reduce((sum, d) => sum + d.history.length, 0),
    };
  }, [domains]);

  // Final clean return (auto fields included)
  return {
    domains,
    filteredAndSorted,
    isLoading,
    updating,
    search,
    setSearch,
    sortMode,
    setSortMode,
    toasts,
    dismissToast,
    addDomain,
    refreshDomain,
    refreshAll,
    removeDomain,
    clearAll,
    selectedDomain,
    selectDomain,
    getDomain,
    exportData,
    importData,
    stats,
    // Auto weekly cron surface
    autoRefreshEnabled,
    lastAutoRefresh,
    toggleAutoRefresh,
    runAutoRefreshNow,
    customCount,

    // Prediction / submission feature ("websites you think will be at the top")
    predictions,
    addPrediction,
    removePrediction,
  };
}
