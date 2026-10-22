'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Download, ListFilter, Play, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import {
  CATEGORY_LABELS,
  SCORE_CATEGORIES,
  formatScore,
  importSnapshot,
  isCategory,
  parseWorkspace,
  planNextLever,
  prerequisiteSatisfied,
  readScoreboardStorage,
  safeEvidenceUrl,
  scoreTotal,
  transitionLever,
  type CycleRecord,
  type Lever,
  type LeverStatus,
  type Score,
  type ScoreWorkspace,
} from '@/lib/scoreboard';

const control =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
const STATUS_LABELS: Record<LeverStatus, string> = {
  queued: 'Queued',
  active: 'Active',
  awaiting_evidence: 'Awaiting evidence',
  verified: 'Verified',
  parked: 'Parked',
};
const PRIORITY = { critical: 0, high: 1, normal: 2 };
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'The workspace could not be updated.';
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function ScoreValue({ score }: { score: Score }) {
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        score.status !== 'estimated' && 'text-muted-foreground'
      )}
    >
      {score.status === 'estimated'
        ? formatScore(score.value ?? 0)
        : score.status === 'unknown'
          ? 'Unassessed'
          : 'Exempt'}
    </span>
  );
}

function saveFile(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProductScoreboard({ accountId }: { accountId: string }) {
  const storageKey = `saasmaker.scoreboard.v1:${accountId}`;
  const [workspace, setWorkspace] = useState<ScoreWorkspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const [pending, setPending] = useState<ScoreWorkspace | null>(null);
  const [pendingBackup, setPendingBackup] = useState(false);
  const [mode, setMode] = useState('scores');
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [category, setCategory] = useState('');
  const [domain, setDomain] = useState('');
  const [scope, setScope] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('priority');
  const input = useRef<HTMLInputElement>(null);
  const detailsHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const stored = readScoreboardStorage(() => localStorage.getItem(storageKey));
      if (!stored.available) {
        setSaved(false);
        setError(
          'Browser storage is unavailable. You can import a review and export this tab before closing it.'
        );
      }
      if (stored.raw) setWorkspace(parseWorkspace(stored.raw));
    } catch (e) {
      setError(`Saved workspace was preserved but could not be opened: ${errorText(e)}`);
    }
    const params = new URLSearchParams(window.location.search);
    setProject(params.get('project') ?? '');
    setCategory(isCategory(params.get('category')) ? (params.get('category') ?? '') : '');
    setDomain(params.get('domain') ?? '');
    setMode(params.get('mode') === 'levers' ? 'levers' : 'scores');
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      if (!saved) {
        setError('Another tab changed this workspace. Export this tab before reloading.');
        return;
      }
      try {
        setWorkspace(parseWorkspace(event.newValue));
      } catch (e) {
        setError(errorText(e));
      }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [storageKey, saved]);

  function persist(next: ScoreWorkspace) {
    setError('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setError(`Changes are only in this tab. Export a backup now: ${errorText(e)}`);
    }
    setWorkspace(next);
  }
  async function updateWorkspace(
    fn: (current: ScoreWorkspace | null) => ScoreWorkspace,
    replaceInvalid = false
  ) {
    const update = () => {
      try {
        const { raw } = readScoreboardStorage(() =>
          saved ? localStorage.getItem(storageKey) : null
        );
        let current = workspace;
        if (raw) {
          try {
            current = parseWorkspace(raw);
          } catch (e) {
            if (!replaceInvalid) throw e;
          }
        }
        persist(fn(current));
      } catch (e) {
        setError(errorText(e));
      }
    };
    if (navigator.locks) await navigator.locks.request(storageKey, update);
    else update();
  }
  function change(fn: (current: ScoreWorkspace) => ScoreWorkspace) {
    void updateWorkspace((current) => {
      if (!current) throw new Error('Import a review first.');
      return fn(current);
    });
  }
  async function readImport(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('Import is too large (maximum 8 MB).');
      const text = await file.text();
      const incoming = parseWorkspace(text);
      setPendingBackup('snapshot' in JSON.parse(text));
      const { raw } = readScoreboardStorage(() => localStorage.getItem(storageKey));
      if (workspace || raw) setPending(incoming);
      else await updateWorkspace((current) => importSnapshot(current, incoming));
    } catch (e) {
      setError(`Import rejected; existing data was preserved. ${errorText(e)}`);
    }
    if (input.current) input.current.value = '';
  }
  function focusLever(id: string) {
    const lever = workspace?.snapshot.levers.find((l) => l.id === id);
    if (!lever) return;
    setProject(lever.projectId);
    setCategory(lever.category);
    setMode('levers');
    setStatus('all');
    setQuery('');
    setDomain('');
    setScope('all');
    requestAnimationFrame(() => detailsHeading.current?.focus());
  }
  async function copyFocus() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      view: 'scoreboard',
      mode,
      ...(project && { project }),
      ...(category && { category }),
      ...(domain && { domain }),
    }).toString();
    try {
      await navigator.clipboard.writeText(url.href);
      setError('Focus link copied. The recipient needs their own private workspace.');
    } catch {
      setError(`Copy this focus link: ${url.href}`);
    }
  }

  const snapshot = workspace?.snapshot;
  const scores = snapshot?.projects.flatMap((p) => Object.values(p.scores)) ?? [];
  const assessed = scores.filter((s) => s.status === 'estimated');
  const unassessed = scores.filter((s) => s.status === 'unknown').length;
  const exempt = scores.filter((s) => s.status === 'not_applicable').length;
  const provisional = assessed.filter((s) => s.confidence === 'low').length;
  const active = workspace && Object.values(workspace.progress).find((p) => p?.status === 'active');
  const waiting = workspace
    ? Object.values(workspace.progress).filter((p) => p?.status === 'awaiting_evidence')
    : [];
  const verified = workspace ? workspace.history.filter((p) => p.status === 'verified').length : 0;
  const visibleProjects =
    snapshot?.projects.filter(
      (p) =>
        (!project || p.id === project) &&
        (!domain || p.domains.includes(domain)) &&
        (scope === 'all' || (scope === 'internal' ? p.internal : !p.internal)) &&
        (!query ||
          [p.name, p.segment, ...p.domains].join(' ').toLowerCase().includes(query.toLowerCase()))
    ) ?? [];
  visibleProjects.sort((a, b) => {
    if (sort === 'score') {
      const c = isCategory(category) ? category : 'product';
      return (
        (a.scores[c].value ?? Infinity) - (b.scores[c].value ?? Infinity) ||
        a.name.localeCompare(b.name)
      );
    }
    if (sort === 'priority' && snapshot) {
      const pa = snapshot.levers.find((l) => l.id === a.bestNextLeverId)?.priority ?? 'normal';
      const pb = snapshot.levers.find((l) => l.id === b.bestNextLeverId)?.priority ?? 'normal';
      return PRIORITY[pa] - PRIORITY[pb] || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  const visibleIds = new Set(visibleProjects.map((p) => p.id));
  const levers =
    snapshot?.levers
      .filter(
        (l) =>
          visibleIds.has(l.projectId) &&
          (!category || l.category === category) &&
          (status === 'all' || status === 'scope'
            ? status === 'all' || l.kind === 'scope'
            : (workspace?.progress[l.id]?.status ?? 'queued') === status && l.kind === 'action')
      )
      .sort((a, b) =>
        sort === 'score'
          ? (snapshot.projects.find((p) => p.id === a.projectId)?.scores[a.category].value ??
              Infinity) -
              (snapshot.projects.find((p) => p.id === b.projectId)?.scores[b.category].value ??
                Infinity) || a.title.localeCompare(b.title)
          : sort === 'name'
            ? a.projectId.localeCompare(b.projectId) || a.category.localeCompare(b.category)
            : PRIORITY[a.priority] - PRIORITY[b.priority] || a.projectId.localeCompare(b.projectId)
      ) ?? [];
  const firstReady = snapshot?.levers
    .filter(
      (l) =>
        l.kind === 'action' &&
        (!workspace?.progress[l.id] || workspace.progress[l.id]?.status === 'parked') &&
        l.dependencies.every((id) => workspace && prerequisiteSatisfied(workspace, id))
    )
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority])[0];

  return (
    <div className="space-y-6" data-clarity-mask="true">
      <PageHeader
        title="Product scoreboard"
        description="Six areas. One next lever. Evidence before a higher score."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Import private scoreboard"
              onChange={(e) => void readImport(e.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => input.current?.click()}>
              <Upload />
              Import review
            </Button>
            <Button
              variant="outline"
              disabled={!workspace}
              onClick={() =>
                workspace &&
                saveFile(
                  `saasmaker-scoreboard-${new Date().toISOString().slice(0, 10)}.json`,
                  workspace
                )
              }
            >
              <Download />
              Export backup
            </Button>
          </div>
        }
      />
      <p className="text-xs text-muted-foreground">
        Private to this browser and signed-in account. No review data is uploaded. Export to back up
        or move devices.{' '}
        {workspace && (saved ? 'Saved on this device.' : 'Unsaved changes — export now.')}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {pending && (
        <section
          className="space-y-3 rounded-lg border border-primary/50 p-4"
          aria-label="Review import"
        >
          <h2 className="font-semibold">Import {pending.snapshot.label}?</h2>
          <p className="text-sm text-muted-foreground">
            {pending.snapshot.projects.length} projects · {pending.snapshot.levers.length}{' '}
            recommendations. A baseline update keeps history and matching progress. A workspace
            backup or “Replace workspace” discards the current workspace; export it first if needed.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void updateWorkspace(
                  (current) => (pendingBackup ? pending : importSnapshot(current, pending)),
                  true
                );
                setPending(null);
              }}
            >
              {pendingBackup ? 'Restore backup' : 'Import and keep history'}
            </Button>
            {!pendingBackup && (
              <Button
                variant="outline"
                onClick={() => {
                  void updateWorkspace(() => pending, true);
                  setPending(null);
                }}
              >
                Replace workspace
              </Button>
            )}
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {!loaded ? (
        <p role="status">Opening your saved scoreboard…</p>
      ) : !snapshot || !workspace ? (
        <section className="rounded-lg border border-border bg-card p-6 sm:p-10">
          <Badge variant="outline">Owner workspace</Badge>
          <h2 className="mt-4 text-2xl font-semibold">
            Bring the review. Pick the next useful change.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Import the private review JSON to see every product, its six scores out of ten, dated
            evidence and biggest next lever. Then work on one lever at a time and keep the result
            here.
          </p>
          <ol className="my-6 grid gap-3 text-sm sm:grid-cols-4">
            {[
              '1. Pick one lever',
              '2. Make the change',
              '3. Check the evidence',
              '4. Choose what follows',
            ].map((s) => (
              <li key={s} className="rounded-md border border-border p-3">
                {s}
              </li>
            ))}
          </ol>
          <Button onClick={() => input.current?.click()}>
            <Upload />
            Import private review JSON
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            The assessment and recommendations stay on this device. No private baseline is shipped
            in the public directory or this application bundle.
          </p>
        </section>
      ) : (
        <>
          <section
            className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-4 text-sm"
            aria-label="Review coverage"
          >
            <span>
              <strong>{snapshot.projects.length}</strong> projects
            </span>
            <span>
              <strong>{snapshot.levers.length}</strong> category recommendations
            </span>
            <span>
              <strong>
                {assessed.length}/{scores.length - exempt}
              </strong>{' '}
              applicable areas scored
              {unassessed > 0 && ` · ${unassessed} unassessed`}
              {` · ${provisional} provisional · ${exempt} exempt`}
            </span>
            <span>
              Target <strong>{formatScore(snapshot.target)}/10</strong> per applicable area
            </span>
            <span>
              {verified} verified cycles · {waiting.length} awaiting evidence
            </span>
            <span className="text-muted-foreground">Assessed {dateLabel(snapshot.assessedAt)}</span>
          </section>
          <section className="space-y-2 text-sm" aria-label="How to read the scores">
            <p>
              <strong>5 = competitive · 7.5 = among the best · 10 = sustained leader.</strong> Your
              target is {formatScore(snapshot.target)}/10. A 5 is a competitive product with room to
              improve.
            </p>
            <p className="text-muted-foreground">
              Scores are best estimates. Low confidence means provisional: inspect the evidence and
              its limits. Missing evidence lowers confidence; it does not automatically lower
              quality. A provisional GEO estimate does not establish actual AI recommendation share.
              Exempt means an area is outside the tool’s purpose.
            </p>
          </section>
          <section
            className="rounded-lg border border-border border-l-4 border-l-primary bg-card p-4 sm:p-5"
            aria-label="One lever cadence"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">One lever at a time</h2>
              <Badge variant="outline">Pick → change → verify → next</Badge>
            </div>
            {active ? (
              <>
                <p className="font-medium">
                  {snapshot.projects.find((p) => p.id === active.leverId.split(':')[0])?.name} ·{' '}
                  {active.plan.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  One lever is active. Record the outcome, park it, or mark the evidence window
                  before starting another.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => focusLever(active.leverId)}
                >
                  Open active lever
                  <ArrowUpRight />
                </Button>
              </>
            ) : firstReady ? (
              <>
                <p className="font-medium">
                  Suggested next:{' '}
                  {snapshot.projects.find((p) => p.id === firstReady.projectId)?.name} ·{' '}
                  {firstReady.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{firstReady.why}</p>
                <Button className="mt-3" onClick={() => focusLever(firstReady.id)}>
                  Inspect this lever
                  <ArrowUpRight />
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Review waiting evidence or plan a follow-up on a completed lever.
              </p>
            )}
            {waiting.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Waiting for evidence is separate from verified improvement. Check these at your next
                review; their scores remain unchanged.
              </p>
            )}
          </section>
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Scoreboard view">
              {[
                ['scores', 'Scoreboard'],
                ['levers', 'Next levers'],
                ['history', 'Outcome history'],
              ].map(([id, label]) => (
                <Button
                  key={id}
                  variant={mode === id ? 'default' : 'outline'}
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => void copyFocus()}>
              Copy focus link
            </Button>
          </div>
          {mode !== 'history' && (
            <section
              className="rounded-lg border border-border bg-card p-4"
              aria-label="Focus the scoreboard"
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1 text-xs text-muted-foreground">
                  Search product, purpose or domain
                  <input
                    className={control}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find your next focus…"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Product
                  <select
                    className={control}
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                  >
                    <option value="">Every product</option>
                    {snapshot.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Assessment area
                  <select
                    className={control}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All six areas</option>
                    {SCORE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Website domain
                  <select
                    className={control}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  >
                    <option value="">Every domain</option>
                    {[...new Set(snapshot.projects.flatMap((p) => p.domains))].sort().map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Evaluation scope
                  <select
                    className={control}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="all">Products and internal tools</option>
                    <option value="products">Products only</option>
                    <option value="internal">Internal utility only</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  Order
                  <select
                    className={control}
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="priority">Critical levers first</option>
                    <option value="score">Lowest known area score (Product by default)</option>
                    <option value="name">Product name</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {visibleProjects.length} projects · {levers.length} category recommendations match
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setQuery('');
                    setProject('');
                    setCategory('');
                    setDomain('');
                    setScope('all');
                    setStatus('all');
                  }}
                >
                  Reset filters
                  <ListFilter />
                </Button>
              </div>
            </section>
          )}
          {mode === 'scores' && (
            <>
              <p className="text-sm text-muted-foreground">
                Each area is out of 10; six applicable scores have a maximum of 60. Exempt areas are
                excluded from the total. Partial sums are shown without inventing missing scores or
                comparing different denominators.
              </p>
              <div
                className="overflow-x-auto rounded-lg border border-border"
                role="region"
                aria-label="Product scores"
                // biome-ignore lint/a11y/noNoninteractiveTabindex: the horizontally scrolling score table must support keyboard scrolling.
                tabIndex={0}
              >
                <table className="w-full min-w-[960px] text-sm">
                  <caption className="sr-only">
                    Six category estimates, confidence, partial totals and the best next lever for
                    each project.
                  </caption>
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="p-3">Product</th>
                      {SCORE_CATEGORIES.map((c) => (
                        <th key={c} className={cn('p-3', c === category && 'bg-primary/10')}>
                          <button
                            className="text-left text-xs"
                            onClick={() => {
                              setCategory(c);
                              setSort('score');
                            }}
                          >
                            {CATEGORY_LABELS[c]} ↓
                          </button>
                        </th>
                      ))}
                      <th className="p-3">Total / coverage</th>
                      <th className="p-3">Best next lever</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProjects.map((p) => {
                      const total = scoreTotal(p);
                      const best = snapshot.levers.find((l) => l.id === p.bestNextLeverId);
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-border align-top hover:bg-muted/15"
                        >
                          <th scope="row" className="p-3 text-left font-medium">
                            <button
                              className="text-left underline decoration-border underline-offset-4 hover:decoration-primary"
                              onClick={() => {
                                setProject(p.id);
                                setCategory('');
                                setMode('levers');
                              }}
                            >
                              {p.name}
                            </button>
                            <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                              {p.internal ? 'Internal utility' : 'Product'}
                              {p.domains[0] && ` · ${p.domains[0]}`}
                            </span>
                          </th>
                          {SCORE_CATEGORIES.map((c) => (
                            <td key={c} className={cn('p-3', c === category && 'bg-primary/5')}>
                              <button
                                aria-label={`${p.name}: ${CATEGORY_LABELS[c]} evidence`}
                                onClick={() => focusLever(`${p.id}:${c}`)}
                                className="min-h-10 text-left"
                              >
                                <ScoreValue score={p.scores[c]} />
                                <span className="block text-[10px] text-muted-foreground">
                                  {p.scores[c].status === 'estimated'
                                    ? p.scores[c].confidence === 'low'
                                      ? 'provisional · low confidence'
                                      : `${p.scores[c].confidence} confidence`
                                    : p.scores[c].status === 'not_applicable'
                                      ? 'outside scope'
                                      : 'evidence needed'}
                                </span>
                              </button>
                            </td>
                          ))}
                          <td className="p-3">
                            <span className="font-mono">
                              {formatScore(total.sum)}
                              {total.complete ? ` / ${total.maximum}` : ' known'}
                            </span>
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                              {total.unknown > 0 && `${total.unknown} unknown · `}
                              {total.exempt > 0 && `${total.exempt} exempt · `}
                              {total.knownMax} assessed points
                            </span>
                          </td>
                          <td className="max-w-64 p-3">
                            {best && (
                              <button
                                className="text-left text-xs underline decoration-border underline-offset-4"
                                onClick={() => focusLever(best.id)}
                              >
                                {best.title}
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                  {STATUS_LABELS[workspace.progress[best.id]?.status ?? 'queued']}
                                </span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {mode === 'levers' && (
            <section className="space-y-4" aria-label="Category recommendations">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 ref={detailsHeading} tabIndex={-1} className="text-lg font-semibold">
                  {levers.length} next-lever recommendations
                </h2>
                <label className="text-sm">
                  Status{' '}
                  <select
                    className={cn(control, 'ml-2 w-auto')}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">All recommendations</option>
                    {Object.entries(STATUS_LABELS).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                    <option value="scope">Scope decisions</option>
                  </select>
                </label>
              </div>
              {levers.length === 0 && (
                <p className="rounded-lg border border-border p-6 text-muted-foreground">
                  No recommendations match. Reset the filters or choose another status.
                </p>
              )}
              {levers.map((lever) => (
                <LeverCard
                  key={`${lever.id}:${lever.followsCycleId ?? 'baseline'}`}
                  lever={lever}
                  workspace={workspace}
                  activeId={active?.leverId}
                  onChange={change}
                />
              ))}
            </section>
          )}
          {mode === 'history' && (
            <section className="space-y-3" aria-label="Outcome history">
              <h2 className="text-lg font-semibold">Decisions and outcomes</h2>
              <p className="text-sm text-muted-foreground">
                The plan, baseline score and evidence are retained for every step. Verified work
                does not automatically change an assessment.
              </p>
              {workspace.history.length === 0 ? (
                <p className="rounded-lg border border-border p-6">
                  No cycles yet. Inspect a lever and choose “Pick this lever”.
                </p>
              ) : (
                [...workspace.history].reverse().map((record) => (
                  <article key={record.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong className="text-sm">{record.plan.title}</strong>
                      <Badge variant="outline">{STATUS_LABELS[record.status]}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {record.leverId} · {dateLabel(record.at)} · baseline{' '}
                      {record.plan.baselineScore === null
                        ? 'U'
                        : `${formatScore(record.plan.baselineScore)}/10`}
                    </p>
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer">
                        Original action and proof criteria
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap">{record.plan.action}</p>
                      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        Proof: {record.plan.proof}
                      </p>
                    </details>
                    {record.result && (
                      <p className="mt-2 whitespace-pre-wrap text-sm">{record.result}</p>
                    )}
                    {record.evidence && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        Evidence: {record.evidence}
                      </p>
                    )}
                    {record.prerequisiteSatisfied && (
                      <p className="mt-2 text-xs">Prerequisite objective accepted.</p>
                    )}
                    {record.outcome && <p className="mt-2 text-xs">Outcome: {record.outcome}</p>}
                  </article>
                ))
              )}
            </section>
          )}
          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer font-medium">
              How to read this review and keep the cadence
            </summary>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                Imported baseline scores are estimates, with confidence and dated evidence. The
                original four-point grades are scaled by 2.5; 3.5/4 becomes 8.75/10. This conversion
                adds no new evidence or precision.
              </p>
              <p>
                Internal tools are evaluated for usefulness and dependability. SEO/GEO exemptions
                preserve the owner’s scope; there is no penalty for intentionally having no public
                acquisition goal.
              </p>
              <p>
                For design, observe actual comprehension, friction, delight and preference in the
                core workflow. A mechanical checklist or a score alone does not establish excellent
                design.
              </p>
              <p>
                Pick one actionable lever, make the bounded change, then record what happened. Use
                “Await evidence” for delayed measurement, “Verify outcome” only with evidence, or
                park with a reason. Verified or parked levers can receive a new follow-up while
                their history remains intact.
              </p>
              <p>
                Review waiting evidence at the next work session and review the whole queue weekly.
                No background job, production action, GitHub issue or notification is created from
                this board.
              </p>
              <p>
                This is device-local storage, not a server backup. Export after a review session. A
                new baseline import keeps matching progress; a workspace backup import replaces it
                after confirmation.
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function LeverCard({
  lever,
  workspace,
  activeId,
  onChange,
}: {
  lever: Lever;
  workspace: ScoreWorkspace;
  activeId?: string;
  onChange: (fn: (current: ScoreWorkspace) => ScoreWorkspace) => void;
}) {
  const project = workspace.snapshot.projects.find((p) => p.id === lever.projectId)!;
  const score = project.scores[lever.category];
  const progress = workspace.progress[lever.id];
  const currentStatus = progress?.status ?? 'queued';
  const [result, setResult] = useState(progress?.result ?? '');
  const [evidence, setEvidence] = useState(progress?.evidence ?? '');
  const [accepted, setAccepted] = useState(false);
  const [outcome, setOutcome] = useState<Exclude<CycleRecord['outcome'], null>>('learning');
  const [title, setTitle] = useState('');
  const [action, setAction] = useState('');
  const [proof, setProof] = useState('');
  const blocked = lever.dependencies.filter((id) => !prerequisiteSatisfied(workspace, id));
  const record = (state: 'active' | 'awaiting_evidence' | 'verified' | 'parked') =>
    onChange((current) =>
      transitionLever(current, lever.id, state, {
        result,
        evidence,
        outcome: state === 'verified' ? outcome : null,
        prerequisiteSatisfied: state === 'verified' && outcome === 'helped' && accepted,
      })
    );
  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-4 sm:p-5',
        currentStatus === 'active' ? 'border-primary' : 'border-border'
      )}
    >
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {project.name} · {CATEGORY_LABELS[lever.category]}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{lever.title}</h3>
        </div>
        <div className="flex items-start gap-2">
          <Badge variant="outline">
            {lever.kind === 'scope' ? 'Scope decision' : STATUS_LABELS[currentStatus]}
          </Badge>
          <Badge variant={lever.priority === 'critical' ? 'destructive' : 'secondary'}>
            {lever.priority}
          </Badge>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{lever.action}</p>
      <p className="mt-2 text-sm text-muted-foreground">{lever.why}</p>
      <div className="mt-4 rounded-md bg-muted/30 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Evidence needed to close this lever
        </p>
        <p className="mt-1 text-sm">{lever.proof}</p>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm">
          <ScoreValue score={score} />
          {score.status === 'estimated' && '/10'} · {score.confidence} confidence · inspect
          assessment and evidence
        </summary>
        <div className="mt-3 space-y-3 border-l border-border pl-4">
          <p className="text-sm">{score.reason}</p>
          {score.evidence.map((e, i) => (
            <div key={`${i}:${e.source}`} className="text-xs">
              <span className="text-muted-foreground">{dateLabel(e.date)}</span>
              <p className="mt-1">{e.note}</p>
              {safeEvidenceUrl(e.source) ? (
                <a
                  className="mt-1 block break-all underline"
                  href={safeEvidenceUrl(e.source) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {e.source}
                </a>
              ) : (
                <code className="mt-1 block break-all text-muted-foreground">
                  Local evidence: {e.source}
                </code>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Source revision: {project.sourceRevision}</p>
          {project.limitations.map((l) => (
            <p key={l} className="text-xs text-muted-foreground">
              Limit: {l}
            </p>
          ))}
        </div>
      </details>
      {blocked.length > 0 && (
        <p className="mt-3 text-xs text-amber-500">Prerequisites: {blocked.join(', ')}</p>
      )}
      {lever.kind === 'action' && (currentStatus === 'queued' || currentStatus === 'parked') && (
        <Button
          className="mt-4"
          disabled={!!activeId || blocked.length > 0}
          onClick={() => onChange((current) => transitionLever(current, lever.id, 'active'))}
        >
          <Play />
          Pick this lever
        </Button>
      )}
      {(currentStatus === 'active' || currentStatus === 'awaiting_evidence') && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <label className="block space-y-1 text-sm">
            What changed or what did you learn?
            <textarea
              className={cn(control, 'h-24 py-2')}
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            Evidence, date and scope
            <textarea
              className={cn(control, 'h-20 py-2')}
              placeholder="A result, receipt, test or observation with its exact scope…"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            Observed outcome
            <select
              className={control}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as typeof outcome)}
            >
              <option value="learning">Learned what to do next</option>
              <option value="helped">Helped</option>
              <option value="unchanged">No material change</option>
              <option value="worse">Worse / needs recovery</option>
            </select>
          </label>
          {outcome === 'helped' && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-1"
              />
              The original objective is achieved; this proof may unblock dependent levers.
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Save a progress note before leaving to retain this text without claiming an outcome.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!result.trim()}
              onClick={() => record(currentStatus === 'active' ? 'active' : 'awaiting_evidence')}
            >
              Save progress note
            </Button>
            <Button
              disabled={!result.trim() || !evidence.trim()}
              onClick={() => record('verified')}
            >
              <Check />
              Verify outcome
            </Button>
            <Button
              variant="outline"
              disabled={!result.trim()}
              onClick={() => record('awaiting_evidence')}
            >
              Await evidence
            </Button>
            <Button variant="ghost" disabled={!result.trim()} onClick={() => record('parked')}>
              Park with reason
            </Button>
          </div>
        </div>
      )}
      {(currentStatus === 'verified' || currentStatus === 'parked') && (
        <details className="mt-4 rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Plan the next lever in this area
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block space-y-1 text-sm">
              Next lever title
              <input className={control} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              One bounded change
              <textarea
                className={cn(control, 'h-20 py-2')}
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              What evidence would close it?
              <textarea
                className={cn(control, 'h-20 py-2')}
                value={proof}
                onChange={(e) => setProof(e.target.value)}
              />
            </label>
            <Button
              disabled={![title, action, proof].every((x) => x.trim())}
              onClick={() => {
                onChange((current) => planNextLever(current, lever.id, { title, action, proof }));
                setTitle('');
                setAction('');
                setProof('');
              }}
            >
              Queue follow-up
            </Button>
            <p className="text-xs text-muted-foreground">
              The previous plan and outcome stay in history. The assessment score stays unchanged.
            </p>
          </div>
        </details>
      )}
    </article>
  );
}
