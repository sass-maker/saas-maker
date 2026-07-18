'use client';

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Plus,
  Trash2,
  Download,
  X,
  Search,
  BarChart3,
  Settings,
  TrendingUp,
  Calendar,
  Users,
} from 'lucide-react';
const DrHistoryChart = lazy(() =>
  import('@/components/DrHistoryChart').then((m) => ({ default: m.DrHistoryChart }))
);

import { useTrackedDomains } from '@/lib/useTrackedDomains';
import {
  Sparkline,
  formatDate,
  formatRelativeTime,
  getCurrentDR,
  getDRBarColor,
  getDRColor,
  getTrend,
  getFaviconUrl,
  getWeeklyChange,
  formatNextAuto,
  computeGainersLosers,
} from '@/lib/utils';
import type { TrackedDomain } from '@/lib/types';
import { DrAdvisor } from '@/components/DrAdvisor';

// Shared global example sites + historical DR data (maintained via GitHub Action + JSON)
// Static import for build-time / offline fallback
import globalSitesStatic from '@/data/global-sites.json';
import globalDrDataStatic from '@/data/global-dr.json';

// Configurable raw GitHub URL for fresh data after Action runs (no redeploy needed on Vercel)
const GLOBAL_DATA_BASE =
  process.env.NEXT_PUBLIC_GLOBAL_DATA_BASE ||
  'https://raw.githubusercontent.com/High-Signal-App/drank/main/data';
const GLOBAL_DR_URL = `${GLOBAL_DATA_BASE}/global-dr.json`;
const GLOBAL_SITES_URL = `${GLOBAL_DATA_BASE}/global-sites.json`;

// Build initial global domains from static (will be overwritten by fresh fetch on client)
const GLOBAL_DOMAINS: TrackedDomain[] = (globalSitesStatic as string[]).map((domain: string) => {
  const domainsObj = (globalDrDataStatic as any).domains || {};
  const hist = domainsObj[domain]?.history || [];
  return {
    domain,
    history: hist,
    lastChecked: hist.length > 0 ? hist[hist.length - 1].ts : null,
    isCustom: false,
  };
});

const COMMUNITY_NOMINATIONS: any[] = (globalDrDataStatic as any).communityNominations || [];

export default function Drank() {
  const {
    filteredAndSorted: filteredUser,
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
    getDomain: getUserDomain,
    exportData,
    importData,
    stats,
    // Weekly auto for YOUR sites only
    autoRefreshEnabled,
    lastAutoRefresh,
    toggleAutoRefresh,
    runAutoRefreshNow,
    customCount,

    // Predictions / submit for top
    predictions,
    addPrediction,
    removePrediction,
  } = useTrackedDomains();

  // Live global data state (starts from static build import, refreshed from GitHub raw on client)
  const [liveGlobalDomains, setLiveGlobalDomains] = useState<TrackedDomain[]>(GLOBAL_DOMAINS);
  const [liveCommunityNoms, setLiveCommunityNoms] = useState<any[]>(COMMUNITY_NOMINATIONS);
  const [belowFold, setBelowFold] = useState(false);

  useEffect(() => {
    // Fade out the LCP shell smoothly instead of instant removal.
    // The shell is a fixed overlay (see layout.tsx) so it never affected
    // document flow — fading it out causes zero layout shift.
    const shell = document.getElementById('drank-lcp-shell');
    if (shell) {
      shell.classList.add('drank-lcp-fading');
      const removeShell = () => shell.remove();
      shell.addEventListener('transitionend', removeShell, { once: true });
      // Fallback in case transitionend doesn't fire
      setTimeout(removeShell, 300);
    }
    const run = () => setBelowFold(true);
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(run, { timeout: 1200 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(run, 0);
    return () => clearTimeout(t);
  }, []);

  // Fetch fresher shared data from raw GitHub so that weekly Action updates are visible
  // without needing a new Vercel deployment every time.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [drRes, sitesRes] = await Promise.allSettled([
          fetch(GLOBAL_DR_URL, { cache: 'no-store' }),
          fetch(GLOBAL_SITES_URL, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const drResponse = drRes.status === 'fulfilled' ? drRes.value : null;
        const sitesResponse = sitesRes.status === 'fulfilled' ? sitesRes.value : null;

        const canUseDr = !!drResponse?.ok;
        const canUseSites = !!sitesResponse?.ok;
        if (!canUseDr && !canUseSites) return;

        const freshDr = canUseDr ? await drResponse.json() : globalDrDataStatic;
        const freshSites = canUseSites ? await sitesResponse.json() : globalSitesStatic;

        const domainsObj = freshDr.domains || {};
        const freshDomains: TrackedDomain[] = (freshSites as string[]).map((domain: string) => {
          const hist = domainsObj[domain]?.history || [];
          return {
            domain,
            history: hist,
            lastChecked: hist.length > 0 ? hist[hist.length - 1].ts : null,
            isCustom: false,
          };
        });

        setLiveGlobalDomains(freshDomains);
        setLiveCommunityNoms(freshDr.communityNominations || []);
      } catch {
        // graceful fallback to the data bundled at build time
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Helper: resolve a domain record preferring global shared data, then user local
  const getDomainRecord = (domain: string): TrackedDomain | undefined => {
    const global = liveGlobalDomains.find((d) => d.domain === domain);
    if (global) return global;

    return getUserDomain(domain);
  };

  // Leaderboard: global examples ranked by current DR (shared data, can be live)
  const leaderboard = React.useMemo(() => {
    return [...liveGlobalDomains]
      .map((d) => ({ ...d, currentDR: getCurrentDR(d) }))
      .sort((a, b) => (b.currentDR ?? -1) - (a.currentDR ?? -1));
  }, [liveGlobalDomains]);

  // Community nominations from the shared JSON (user-submitted via PRs/GA merges)
  const _communityNominations = liveCommunityNoms;

  // My predictions accuracy (how many of user's predicted sites are actually high in the real shared leaderboard)
  const predictionAccuracy = React.useMemo(() => {
    if (predictions.length === 0) return null;
    const top20Domains = new Set(leaderboard.slice(0, 20).map((d) => d.domain));
    const hits = predictions.filter((p) => top20Domains.has(p.domain)).length;
    return {
      hits,
      total: predictions.length,
      percent: Math.round((hits / predictions.length) * 100),
    };
  }, [predictions, leaderboard]);

  const [addInput, setAddInput] = useState('');
  const [nominateInput, setNominateInput] = useState('');
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [_importing, setImporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'global' | 'user' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const selected = selectedDomain
    ? selectedSource === 'user'
      ? (getUserDomain(selectedDomain) ?? null)
      : (getDomainRecord(selectedDomain) ?? null)
    : null;
  const selectedCurrentDr = selected ? getCurrentDR(selected) : null;
  const selectedTrend = selected ? getTrend(selected) : null;
  const selectedAdvisorRequest =
    selected && selectedCurrentDr !== null
      ? {
          domain: selected.domain,
          currentDr: selectedCurrentDr,
          trend: {
            direction: selectedTrend?.direction ?? ('unknown' as const),
            delta: selectedTrend?.delta ?? null,
            periodDays:
              selected.history.length >= 2
                ? Math.max(
                    1,
                    Math.min(
                      365,
                      Math.round(
                        (selected.history[selected.history.length - 1].ts -
                          selected.history[selected.history.length - 2].ts) /
                          86_400_000
                      )
                    )
                  )
                : null,
          },
        }
      : null;

  const openGlobalDomain = (domain: string) => {
    setSelectedSource('global');
    selectDomain(domain);
  };

  const openUserDomain = (domain: string) => {
    setSelectedSource('user');
    selectDomain(domain);
  };

  const closeSelectedDomain = () => {
    setSelectedSource(null);
    selectDomain(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !showSettings) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (
        e.key.toLowerCase() === 'a' &&
        document.activeElement?.tagName !== 'INPUT' &&
        !showSettings
      ) {
        e.preventDefault();
        addInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (selectedDomain) closeSelectedDomain();
        else if (showSettings) setShowSettings(false);
      }
      if (e.key.toLowerCase() === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSettings((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDomain, showSettings, closeSelectedDomain]);

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addInput.trim()) return;
    await addDomain(addInput);
    setAddInput('');
  };

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    await refreshAll();
    setIsRefreshingAll(false);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    await importData(file);
    setImporting(false);
    e.target.value = '';
  };

  // Note: Global data is now separate (GLOBAL_DOMAINS from shared JSON).
  // User customs come from the hook (filteredUser). No more mixed displayDomains.

  const nextAutoLabel = formatNextAuto(lastAutoRefresh, autoRefreshEnabled);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading your local data…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200" style={{ contain: 'layout' }}>
      {/* Premium sticky header */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-950 shadow-inner">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-[-1.5px] text-2xl">drank</div>
              <div className="text-[10px] text-zinc-500 -mt-1 font-mono">DOMAIN RATING WATCH</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 active:bg-white/5 transition"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={exportData}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              <Download className="h-4 w-4" /> Export
            </button>

            <button
              onClick={handleRefreshAll}
              disabled={isRefreshingAll}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-60 transition"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingAll ? 'animate-spin' : ''}`} />
              {isRefreshingAll ? 'Refreshing…' : 'Refresh all'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-10 pb-24">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-6xl font-semibold tracking-[-3.2px] text-white">
                Track Domain Ratings.
                <br />
                100% in your browser.
              </h1>
              <p className="mt-3 max-w-md text-xl text-zinc-400">
                See the authority score of ~45 popular sites and your own — free Ahrefs API, no
                sign-up. Your personal history stays in this browser.
              </p>
            </div>
            <div className="hidden lg:block text-right text-sm text-zinc-500 max-w-[260px]">
              Press <span className="font-mono rounded bg-white/10 px-1.5 py-px">/</span> to search
              &nbsp;•&nbsp; <span className="font-mono rounded bg-white/10 px-1.5 py-px">A</span> to
              add &nbsp;•&nbsp;{' '}
              <span className="font-mono rounded bg-white/10 px-1.5 py-px">⌘S</span> settings
            </div>
          </div>
        </div>

        {!belowFold ? (
          <div
            className="min-h-[65vh] rounded-3xl border border-white/5 bg-zinc-900/20"
            style={{ contain: 'layout' }}
            aria-hidden
          />
        ) : (
          <>
            {/* Beautiful Bento Stats */}
            <div
              className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 content-auto"
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 220px' }}
            >
              <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
                  <Users className="h-3.5 w-3.5" /> TOTAL TRACKED
                </div>
                <div className="mt-3 text-6xl font-semibold tabular-nums tracking-[-2px] text-white">
                  {stats.count}
                </div>
                <div className="mt-1 text-xs text-emerald-400/80">your sites in this browser</div>
              </div>

              <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
                  <BarChart3 className="h-3.5 w-3.5" /> YOUR SITES
                </div>
                <div className="mt-3 text-6xl font-semibold tabular-nums tracking-[-2px] text-white">
                  {customCount}
                </div>
                <div className="mt-1 text-xs text-emerald-400/80">eligible for weekly auto</div>
              </div>

              <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
                  AVG DR
                </div>
                <div className="mt-3 text-6xl font-semibold tabular-nums tracking-[-2px] text-white">
                  {stats.avg ?? '—'}
                </div>
                <div className="mt-1 text-xs text-zinc-500">of sites with data</div>
              </div>

              <div className="group rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[1px] text-zinc-500">
                  <TrendingUp className="h-3.5 w-3.5" /> GLOBAL MOVERS
                </div>
                <div className="mt-3 flex items-baseline gap-3 text-6xl font-semibold tabular-nums tracking-[-2px]">
                  <span className="text-white">
                    {(() => {
                      const { gainers } = computeGainersLosers(liveGlobalDomains);
                      return gainers.length;
                    })()}
                  </span>
                  <span className="text-3xl text-emerald-400">↑</span>
                  <span className="text-4xl text-zinc-400">/</span>
                  <span className="text-white">
                    {(() => {
                      const { losers } = computeGainersLosers(liveGlobalDomains);
                      return losers.length;
                    })()}
                  </span>
                  <span className="text-3xl text-red-400">↓</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  gainers / losers in shared data (~7d)
                </div>
              </div>
            </div>

            {/* Add + Auto status bar */}
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <form onSubmit={handleAdd} className="flex w-full max-w-xl items-center gap-2">
                <div className="relative flex-1">
                  <input
                    ref={addInputRef}
                    id="add-input"
                    type="text"
                    value={addInput}
                    onChange={(e) => setAddInput(e.target.value)}
                    placeholder="Add your domain (mysite.com, blog.example.com...)"
                    className="w-full rounded-3xl border border-white/10 bg-zinc-900 px-5 py-3 text-sm placeholder:text-zinc-500 focus:border-white/30 focus:bg-zinc-950 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-3xl bg-white px-8 text-sm font-medium text-zinc-950 transition active:scale-[0.985]"
                >
                  <Plus className="h-4 w-4" /> Add site
                </button>
              </form>

              {/* Auto status — clickable to open settings */}
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 self-start rounded-3xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
              >
                <Calendar className="h-4 w-4 text-emerald-400" />
                <span className="font-medium text-emerald-400">{nextAutoLabel}</span>
                <span className="text-white/40">•</span>
                <span className="text-xs text-white/60">
                  {autoRefreshEnabled ? `${customCount} sites` : 'disabled'}
                </span>
              </button>
            </div>

            {/* Controls */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  id="search-input"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search domains…"
                  className="w-full rounded-3xl border border-white/10 bg-zinc-900 pl-10 py-2.5 text-sm placeholder:text-zinc-500 focus:border-white/30"
                />
              </div>

              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as any)}
                className="h-11 rounded-3xl border border-white/10 bg-zinc-900 px-4 text-sm focus:border-white/30"
              >
                <option value="dr-desc">DR high → low</option>
                <option value="dr-asc">DR low → high</option>
                <option value="trend-desc">Biggest recent movers</option>
                <option value="updated-desc">Recently checked</option>
                <option value="name-asc">A → Z</option>
              </select>

              <div className="flex-1" />

              <div className="text-xs text-zinc-500 hidden md:block pr-1">
                {filteredUser.length} of your sites shown • Global data is shared
              </div>
            </div>

            {/* ==================== GLOBAL EXAMPLES (SHARED) ==================== */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold tracking-wider text-emerald-400/90">
                  GLOBAL EXAMPLES
                </div>
                <div className="text-xs text-white/50">
                  Shared historical DR data for everyone • updated weekly via GitHub Action
                </div>
              </div>
              <div className="text-xs text-white/40 tabular-nums">
                {liveGlobalDomains.length} sites • last shared update (live)
              </div>
            </div>

            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-10"
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 3400px' }}
            >
              <AnimatePresence>
                {liveGlobalDomains.map((d, _index) => {
                  const dr = getCurrentDR(d);
                  const t = getTrend(d);
                  const weekly = getWeeklyChange(d);
                  const color = getDRColor(dr);
                  const _isUpdatingThis = updating.has(d.domain); // rare for global

                  return (
                    <motion.div
                      key={`global-${d.domain}`}
                      initial={false}
                      whileHover={{ y: -3 }}
                      onClick={() => openGlobalDomain(d.domain)}
                      className="group cursor-pointer rounded-3xl border border-white/10 bg-zinc-900/60 p-5 hover:border-white/20 hover:bg-zinc-900 transition flex flex-col"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={getFaviconUrl(d.domain)}
                            alt=""
                            className="h-6 w-6 rounded-md ring-1 ring-white/10"
                            onError={(e) => ((e.currentTarget as any).style.display = 'none')}
                          />
                          <div className="font-mono text-[15px] font-medium tracking-tight text-white truncate">
                            {d.domain}
                          </div>
                        </div>
                        <div className="text-[10px] text-emerald-400/60">shared</div>
                      </div>

                      <div className="mt-5 flex items-baseline gap-3">
                        <div
                          className={`text-[64px] leading-none font-semibold tabular-nums tracking-[-3.5px] ${color.text}`}
                        >
                          {dr != null ? dr.toFixed(1) : '—'}
                        </div>
                        {dr !== null && (
                          <div
                            className="h-2 w-8 rounded-full self-end mb-3"
                            style={{ background: getDRBarColor(dr) }}
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm mt-0.5">
                        {t && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-xs ${t.direction === 'up' ? 'bg-emerald-500/10 text-emerald-400' : t.direction === 'down' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/60'}`}
                          >
                            {t.direction === 'up' && <ArrowUp className="h-3 w-3" />}
                            {t.direction === 'down' && <ArrowDown className="h-3 w-3" />}
                            {t.delta !== 0 ? (t.delta > 0 ? `+${t.delta}` : t.delta) : ''}
                          </span>
                        )}
                        {weekly && weekly.delta !== 0 && (
                          <span className="text-xs text-white/50">
                            7d {weekly.delta > 0 ? '+' : ''}
                            {weekly.delta}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto pt-5 flex items-end justify-between">
                        <Sparkline history={d.history} width={86} height={28} />
                        <div className="text-right text-[10px] text-white/50">
                          LAST SHARED
                          <br />
                          {formatRelativeTime(d.lastChecked)}
                        </div>
                      </div>

                      <div className="mt-4 text-[11px] text-white/40 group-hover:text-white/60 transition">
                        Click for full shared history →
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* ==================== LEADERBOARD (from shared global data) + PREDICT THE TOP ==================== */}
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold tracking-wider text-white">
                  CURRENT LEADERBOARD
                </div>
                <div className="text-xs text-white/50">
                  Ranked by Domain Rating • shared across all users from the GitHub-maintained JSON
                </div>
              </div>
              {predictionAccuracy && (
                <div className="text-right text-xs">
                  <span className="text-emerald-400 font-medium">Your prediction accuracy:</span>{' '}
                  {predictionAccuracy.hits}/{predictionAccuracy.total} in Top 20 (
                  {predictionAccuracy.percent}%)
                </div>
              )}
            </div>

            {/* Dense beautiful leaderboard */}
            <div className="mb-8 rounded-3xl border border-white/10 bg-zinc-900/60 overflow-hidden">
              <div className="divide-y divide-white/10 text-sm">
                {leaderboard.slice(0, 15).map((d, idx) => {
                  const rank = idx + 1;
                  const dr = d.currentDR;
                  const isTop3 = rank <= 3;
                  return (
                    <div
                      key={d.domain}
                      onClick={() => openGlobalDomain(d.domain)}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 cursor-pointer group"
                    >
                      <div
                        className={`w-8 text-right font-mono tabular-nums ${isTop3 ? 'text-2xl font-semibold text-yellow-400' : 'text-white/60'}`}
                      >
                        #{rank}
                      </div>
                      <img src={getFaviconUrl(d.domain)} className="h-5 w-5 rounded" alt="" />
                      <div className="flex-1 font-mono truncate">{d.domain}</div>

                      <div
                        className={`font-semibold tabular-nums w-14 text-right ${getDRColor(dr).text}`}
                      >
                        {dr != null ? dr.toFixed(1) : '—'}
                      </div>

                      <div className="w-24 hidden md:block">
                        <Sparkline history={d.history} width={80} height={22} />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addPrediction(d.domain, 'Predicted top performer');
                        }}
                        className="text-xs rounded-full border border-white/10 px-3 py-1 opacity-60 group-hover:opacity-100 hover:bg-emerald-950 hover:border-emerald-800 transition"
                      >
                        + Predict
                      </button>
                    </div>
                  );
                })}
              </div>
              {leaderboard.length > 15 && (
                <div className="px-5 py-2 text-xs text-white/50 text-center border-t border-white/10">
                  + {leaderboard.length - 15} more in the full shared set
                </div>
              )}
            </div>

            {/* My Predictions / Submit for the top */}
            <div className="mb-10 grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
                <div className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Nominate a site you think will be at the top
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (nominateInput.trim()) {
                      addPrediction(nominateInput);
                      setNominateInput('');
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={nominateInput}
                    onChange={(e) => setNominateInput(e.target.value)}
                    placeholder="another-rising-star.com"
                    className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm placeholder:text-white/40 focus:border-white/30"
                  />
                  <button
                    type="submit"
                    className="rounded-2xl bg-white px-5 text-sm font-medium text-zinc-950"
                  >
                    Nominate
                  </button>
                </form>
                <div className="mt-3 text-[11px] text-white/50">
                  Your picks are saved locally. Use "Share" to contribute them publicly via GitHub.
                </div>
              </div>

              <div className="lg:col-span-3 rounded-3xl border border-white/10 bg-zinc-900/60 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium">My Top Predictions</div>
                  {predictions.length > 0 && (
                    <button
                      onClick={() => {
                        const text = predictions
                          .map((p, i) => `${i + 1}. ${p.domain}${p.note ? ` — ${p.note}` : ''}`)
                          .join('\n');
                        const issueUrl = `https://github.com/High-Signal-App/drank/issues/new?title=DR+Prediction+from+drank&body=${encodeURIComponent(`My predicted top performers:\n\n${text}\n\nSubmitted from the drank app at ${new Date().toISOString()}`)}`;
                        window.open(issueUrl, '_blank', 'noopener,noreferrer');
                        // Also copy
                        navigator.clipboard?.writeText(text).catch(() => {});
                        // Note: showToast is not directly exposed; the action is visible via the opened tab + clipboard
                      }}
                      className="text-xs rounded-full border border-white/10 px-3 py-1 hover:bg-white/5"
                    >
                      Share my predictions
                    </button>
                  )}
                </div>

                {predictions.length === 0 ? (
                  <div className="text-sm text-white/50 py-2">
                    No predictions yet. Nominate sites above or from the leaderboard. They will be
                    scored against the live shared data.
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    {predictions.map((p) => {
                      const _record = getDomainRecord(p.domain);
                      const actualRank =
                        leaderboard.findIndex((d) => d.domain === p.domain) + 1 || null;
                      const isHit = actualRank && actualRank <= 20;
                      return (
                        <div
                          key={p.domain}
                          className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img src={getFaviconUrl(p.domain)} className="h-4 w-4 rounded" />
                            <span className="font-mono truncate">{p.domain}</span>
                            {p.note && (
                              <span className="text-white/40 text-xs truncate max-w-[140px]">
                                “{p.note}”
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            {actualRank ? (
                              <span className={isHit ? 'text-emerald-400' : 'text-white/60'}>
                                currently #{actualRank}
                              </span>
                            ) : (
                              <span className="text-white/40">unranked</span>
                            )}
                            <button
                              onClick={() => removePrediction(p.domain)}
                              className="text-white/40 hover:text-red-400"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Also show community nominations from the shared data if any */}
            {liveCommunityNoms.length > 0 && (
              <div className="mb-8">
                <div className="text-xs uppercase tracking-widest text-white/50 mb-2">
                  Community Nominations (from shared JSON)
                </div>
                <div className="flex flex-wrap gap-2">
                  {liveCommunityNoms.map((n: any) => (
                    <div
                      key={n.domain}
                      onClick={() => openGlobalDomain(n.domain)}
                      className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-xs hover:border-emerald-800 flex items-center gap-2"
                    >
                      {n.domain}
                      {n.note && <span className="text-white/40">— {n.note}</span>}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addPrediction(n.domain);
                        }}
                        className="ml-1 text-emerald-400/70 hover:text-emerald-400"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==================== YOUR SITES (LOCAL + AUTO) ==================== */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold tracking-wider text-white">YOUR SITES</div>
                <div className="text-xs text-emerald-400/80">
                  Private • stored in your browser • auto-refreshed ~weekly when you visit
                </div>
              </div>
              <div className="text-xs text-white/40">{customCount} tracked</div>
            </div>

            {filteredUser.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                  {filteredUser.map((d, _index) => {
                    const dr = getCurrentDR(d);
                    const t = getTrend(d);
                    const weekly = getWeeklyChange(d);
                    const color = getDRColor(dr);
                    const isUpdating = updating.has(d.domain);

                    return (
                      <motion.div
                        key={d.domain}
                        initial={false}
                        whileHover={{ y: -4 }}
                        onClick={() => openUserDomain(d.domain)}
                        className="group cursor-pointer rounded-3xl border border-white/10 bg-zinc-900/70 p-5 hover:border-emerald-900/40 hover:bg-zinc-900 active:scale-[0.995] transition flex flex-col"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={getFaviconUrl(d.domain)}
                              alt=""
                              className="h-6 w-6 rounded-md ring-1 ring-white/10"
                              onError={(e) => ((e.currentTarget as any).style.display = 'none')}
                            />
                            <div>
                              <div className="font-mono text-[15px] font-medium tracking-tight text-white truncate">
                                {d.domain}
                              </div>
                              <div className="text-[10px] text-emerald-400/70">
                                your site • auto weekly
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDomain(d.domain);
                            }}
                            className="rounded-xl p-1.5 text-white/40 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-red-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-5 flex items-baseline gap-3">
                          <div
                            className={`text-[64px] leading-none font-semibold tabular-nums tracking-[-3.5px] ${color.text}`}
                          >
                            {dr != null ? dr.toFixed(1) : '—'}
                          </div>
                          {dr !== null && (
                            <div
                              className="h-2 w-8 rounded-full self-end mb-3"
                              style={{ background: getDRBarColor(dr) }}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          {t && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-px text-xs font-medium ${t.direction === 'up' ? 'bg-emerald-500/10 text-emerald-400' : t.direction === 'down' ? 'bg-red-500/10 text-red-400' : 'bg-white/5'}`}
                            >
                              {t.direction === 'up' && <ArrowUp className="h-3 w-3" />}
                              {t.direction === 'down' && <ArrowDown className="h-3 w-3" />}
                              {t.direction === 'flat' && <Minus className="h-3 w-3" />}
                              {t.delta !== 0 ? (t.delta > 0 ? `+${t.delta}` : t.delta) : ''}
                            </span>
                          )}
                          {weekly && weekly.delta !== 0 && (
                            <span className="text-xs text-white/50">
                              ~7d {weekly.delta > 0 ? '+' : ''}
                              {weekly.delta}
                            </span>
                          )}
                        </div>

                        <div className="mt-auto pt-5 flex items-end justify-between">
                          <Sparkline history={d.history} width={86} height={28} />
                          <div className="text-right">
                            <div className="text-[10px] text-white/40">LAST CHECKED</div>
                            <div className="text-xs text-white/70">
                              {formatRelativeTime(d.lastChecked)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => refreshDomain(d.domain)}
                            disabled={isUpdating}
                            className="flex-1 rounded-2xl border border-white/10 py-2 text-xs font-medium hover:bg-white/5 active:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`}
                            />{' '}
                            REFRESH
                          </button>
                          <button
                            onClick={() => openUserDomain(d.domain)}
                            className="flex-1 rounded-2xl border border-white/10 py-2 text-xs font-medium hover:bg-white/5 active:bg-white/10 flex items-center justify-center gap-1.5"
                          >
                            <BarChart3 className="h-3.5 w-3.5" /> HISTORY
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-8 text-center mb-8">
                <div className="text-lg font-medium text-white">
                  No sites in your personal tracking yet
                </div>
                <p className="mt-2 text-sm text-white/60 max-w-sm mx-auto">
                  Add domains above. They will be stored privately in your browser and can
                  auto-refresh roughly once a week the next time you open this dashboard.
                </p>
              </div>
            )}

            {/* Insights — Gainers / Losers from the shared global examples (the interesting public data) */}
            {(() => {
              const { gainers: gGainers, losers: gLosers } =
                computeGainersLosers(liveGlobalDomains);
              return gGainers.length > 0 || gLosers.length > 0 ? (
                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-4">
                      <TrendingUp className="h-4 w-4" /> GLOBAL GAINERS (LAST ~7 DAYS)
                    </div>
                    <div className="space-y-2 text-sm">
                      {gGainers.map((g) => (
                        <div
                          key={g.domain}
                          onClick={() => openGlobalDomain(g.domain)}
                          className="flex justify-between rounded-2xl bg-white/5 px-4 py-2 cursor-pointer hover:bg-white/10"
                        >
                          <span className="font-mono">{g.domain}</span>
                          <span className="font-medium text-emerald-400">+{g.delta}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-400 mb-4">
                      <ArrowDown className="h-4 w-4" /> GLOBAL LOSERS (LAST ~7 DAYS)
                    </div>
                    <div className="space-y-2 text-sm">
                      {gLosers.map((l) => (
                        <div
                          key={l.domain}
                          onClick={() => openGlobalDomain(l.domain)}
                          className="flex justify-between rounded-2xl bg-white/5 px-4 py-2 cursor-pointer hover:bg-white/10"
                        >
                          <span className="font-mono">{l.domain}</span>
                          <span className="font-medium text-red-400">{l.delta}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="mt-10 text-center text-[11px] text-white/40">
              No account. No personal-domain database. Your domains, history, and generated advice
              stay in this browser.
              <br className="mb-1" />
              <span className="text-white/25">DR data via Ahrefs free public API · </span>
              <a
                href="https://highsignal.app/domains"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-white/30 hover:text-white/50"
              >
                also in highsignal.app
              </a>
            </div>
          </>
        )}
      </div>

      {/* ==================== DETAIL MODAL (more beautiful) ==================== */}
      <AnimatePresence>
        {selected && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
            onClick={closeSelectedDomain}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.18 }}
              className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-white/10 px-7 py-5">
                <div className="flex items-center gap-4">
                  <img src={getFaviconUrl(selected.domain)} className="h-8 w-8 rounded-lg" alt="" />
                  <div>
                    <div className="font-mono text-lg text-white">{selected.domain}</div>
                    <div className="text-xs text-white/50">
                      {selected.isCustom ? 'Your site • auto-refreshes weekly' : 'Popular site'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {(() => {
                    const dr = getCurrentDR(selected);
                    return (
                      <div
                        className={`text-right text-6xl font-semibold tabular-nums tracking-[-2.5px] ${getDRColor(dr).text}`}
                      >
                        {dr != null ? dr.toFixed(1) : '—'}
                      </div>
                    );
                  })()}
                  <button
                    onClick={closeSelectedDomain}
                    className="rounded-full p-2 text-white/60 hover:bg-white/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-7">
                {/* Chart */}
                {selected.history.length >= 2 ? (
                  <div className="h-80 w-full rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                    <Suspense
                      fallback={
                        <div
                          className="h-full animate-pulse rounded-xl bg-zinc-800/40"
                          aria-hidden
                        />
                      }
                    >
                      <DrHistoryChart history={selected.history} />
                    </Suspense>
                  </div>
                ) : (
                  <div className="flex h-60 items-center justify-center rounded-2xl border border-dashed border-white/10 text-center text-sm text-white/50">
                    Keep refreshing this domain over time to build a full history.
                  </div>
                )}

                {selectedAdvisorRequest && <DrAdvisor request={selectedAdvisorRequest} />}

                {/* History list */}
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-white/50">
                    <div>HISTORY • {selected.history.length} POINTS</div>
                    <button
                      onClick={() => refreshDomain(selected.domain)}
                      disabled={updating.has(selected.domain)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1 text-[11px] normal-case hover:bg-white/5"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${updating.has(selected.domain) ? 'animate-spin' : ''}`}
                      />{' '}
                      REFRESH NOW
                    </button>
                  </div>

                  <div className="max-h-[220px] overflow-auto rounded-2xl border border-white/10 bg-zinc-900/40 text-sm">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-zinc-950/90 text-xs text-white/50">
                        <tr>
                          <th className="px-5 py-3 text-left font-normal">DATE</th>
                          <th className="px-5 py-3 text-left font-normal">DR</th>
                          <th className="px-5 py-3 text-left font-normal">CHANGE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {[...selected.history].reverse().map((p, i, arr) => {
                          const prev = arr[i + 1];
                          const delta = prev ? p.dr - prev.dr : null;
                          return (
                            <tr key={p.ts}>
                              <td className="px-5 py-2.5 text-white/70 tabular-nums">
                                {formatDate(p.ts)}
                              </td>
                              <td className="px-5 py-2.5 font-medium tabular-nums text-white">
                                {p.dr.toFixed(1)}
                              </td>
                              <td className="px-5 py-2.5">
                                {delta === null ? (
                                  <span className="text-white/40">—</span>
                                ) : (
                                  <span
                                    className={
                                      delta > 0
                                        ? 'text-emerald-400'
                                        : delta < 0
                                          ? 'text-red-400'
                                          : 'text-white/40'
                                    }
                                  >
                                    {delta > 0 ? '+' : ''}
                                    {delta.toFixed(1)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {selected.history.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-5 py-8 text-center text-white/50">
                              No measurements recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900/70 px-7 py-4">
                {selected?.isCustom ? (
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${selected.domain}?`)) removeDomain(selected.domain);
                    }}
                    className="text-sm text-red-400/80 hover:text-red-400 flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Remove this domain
                  </button>
                ) : (
                  <div className="text-xs text-emerald-400/70">
                    This is a shared global example (updated by GitHub Action)
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={closeSelectedDomain}
                    className="rounded-2xl border border-white/10 px-6 py-2 text-sm hover:bg-white/5"
                  >
                    Close
                  </button>
                  {selected?.isCustom && (
                    <button
                      onClick={() => refreshDomain(selected.domain)}
                      disabled={updating.has(selected.domain)}
                      className="rounded-2xl bg-white px-6 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
                    >
                      Refresh now
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== SETTINGS / PREFERENCES (the "cron" controls) ==================== */}
      <AnimatePresence>
        {showSettings && (
          <div
            className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 pt-16"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-xl tracking-tight">Preferences</div>
                <button onClick={() => setShowSettings(false)}>
                  <X className="h-5 w-5 text-white/50" />
                </button>
              </div>

              <div className="mt-6 space-y-6 text-sm">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">Weekly auto-refresh</div>
                      <div className="text-xs text-white/50 mt-0.5">
                        Only runs for sites you explicitly added (not the popular seed list).
                      </div>
                    </div>
                    <button
                      onClick={() => toggleAutoRefresh(!autoRefreshEnabled)}
                      className={`relative h-7 w-12 rounded-full transition ${autoRefreshEnabled ? 'bg-emerald-500' : 'bg-white/20'}`}
                    >
                      <div
                        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${autoRefreshEnabled ? 'left-[26px]' : 'left-0.5'}`}
                      />
                    </button>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-white/70">
                    When the dashboard is open (or you return to the tab), if it’s been more than 7
                    days since the last auto run, drank will quietly refresh only your custom sites.
                    This is the closest thing to a “cron” while keeping 100% of your data in
                    localStorage.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 p-4 text-xs">
                  <div className="text-white/60">Last auto-refresh</div>
                  <div className="mt-1 text-white">
                    {lastAutoRefresh
                      ? formatDate(lastAutoRefresh)
                      : 'Never (will run on next visit if enabled)'}
                  </div>
                  <div className="mt-3 text-white/60">Next expected</div>
                  <div className="mt-1 text-emerald-400">{nextAutoLabel}</div>
                </div>

                <div>
                  <button
                    onClick={async () => {
                      await runAutoRefreshNow();
                    }}
                    className="w-full rounded-2xl bg-white/10 py-3 text-sm font-medium hover:bg-white/15 active:bg-white/10"
                  >
                    Run weekly refresh for my sites now
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleImportClick}
                    className="flex-1 rounded-2xl border border-white/10 py-2.5 text-xs"
                  >
                    Import JSON
                  </button>
                  <button
                    onClick={exportData}
                    className="flex-1 rounded-2xl border border-white/10 py-2.5 text-xs"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={clearAll}
                    className="flex-1 rounded-2xl border border-red-900/60 py-2.5 text-xs text-red-400"
                  >
                    Clear everything
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="mt-8 text-center text-[10px] text-white/40">
                All data and settings are stored only in your browser.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Beautiful toasts */}
      <div className="fixed bottom-6 right-6 z-[90] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4 }}
              className={`flex max-w-[340px] items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
                t.type === 'error'
                  ? 'border-red-500/30 bg-red-950/80 text-red-200'
                  : t.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-950/70 text-emerald-200'
                    : 'border-white/10 bg-zinc-900/95 text-white'
              }`}
            >
              <div className="flex-1 pt-px">{t.message}</div>
              <button onClick={() => dismissToast(t.id)} className="text-white/40 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
