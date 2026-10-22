'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Download,
  FileText,
  Link,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import { DataTable, type DataColumn, type DataSort } from '@saas-maker/ui/components/data-table';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  assessmentHistory,
  currentAssessment,
  compareAssessments,
  sortableTotal,
  SCORE_CATEGORIES,
  formatScore,
  isCategory,
  planNextLever,
  prerequisiteSatisfied,
  scoreTotal,
  transitionLever,
  type CycleRecord,
  type Lever,
  type LeverStatus,
  type ScoreProject,
  type ScoreWorkspace,
} from '@/lib/scoreboard';
import styles from './scoreboard-workbench.module.css';
import { ScoreEvidence, ScoreValue as Value } from './scoreboard-evidence';
import { ScoreHistory, ScoreDelta } from './scoreboard-history';

const short = CATEGORY_LABELS;
const priority = { critical: 0, high: 1, normal: 2 };
const statusLabel: Record<LeverStatus, string> = {
  queued: 'Queued',
  active: 'Active',
  awaiting_evidence: 'Awaiting evidence',
  verified: 'Verified',
  parked: 'Parked',
};
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const firstSentence = (text: string) => text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? text;

export function ScoreboardWorkbench({
  workspace,
  onChange,
  onImport,
  onExport,
  saved,
}: {
  workspace: ScoreWorkspace;
  onChange: (fn: (current: ScoreWorkspace) => ScoreWorkspace) => void;
  onImport: () => void;
  onExport: () => void;
  saved: boolean;
}) {
  const { snapshot } = workspace;
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [area, setArea] = useState('all');
  const [domain, setDomain] = useState('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<DataSort>([]);
  const [selected, setSelected] = useState('');
  const [sheet, setSheet] = useState<'evidence' | 'action' | 'review' | null>(null);
  const [view, setView] = useState('scores');
  const [notice, setNotice] = useState('');
  const reviews = useMemo(() => assessmentHistory(workspace), [workspace]);
  const [baselineId, setBaselineId] = useState('');
  const currentReview = useMemo(() => currentAssessment(workspace), [workspace]);
  const baseline =
    reviews.find((r) => r.id === baselineId) ??
    reviews.find((r) => r.id !== currentReview.id) ??
    currentReview;
  const changes = compareAssessments(baseline, currentReview);
  const changeById = new Map(changes.map((c) => [c.id, c]));
  const byLever = useMemo(() => new Map(snapshot.levers.map((l) => [l.id, l])), [snapshot]);
  const byProject = useMemo(() => new Map(snapshot.projects.map((p) => [p.id, p])), [snapshot]);
  const active = Object.values(workspace.progress).find((p) => p?.status === 'active');
  const waiting = Object.values(workspace.progress).filter(
    (p) => p?.status === 'awaiting_evidence'
  );
  const orderedLevers = useMemo(
    () =>
      [...snapshot.levers].sort(
        (a, b) =>
          priority[a.priority] - priority[b.priority] ||
          byProject.get(a.projectId)!.name.localeCompare(byProject.get(b.projectId)!.name)
      ),
    [snapshot, byProject]
  );
  const firstReady = orderedLevers.find(
    (l) =>
      l.kind === 'action' &&
      (!workspace.progress[l.id] || workspace.progress[l.id]?.status === 'parked') &&
      l.dependencies.every((id) => prerequisiteSatisfied(workspace, id))
  );
  const fallback = active?.leverId ?? firstReady?.id ?? snapshot.projects[0].bestNextLeverId;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const project = params.get('project') ?? '';
    const category = params.get('category');
    if (byProject.has(project)) {
      setProjectFilter(project);
      setSelected(
        isCategory(category) ? `${project}:${category}` : byProject.get(project)!.bestNextLeverId
      );
    }
    if (isCategory(category)) setArea(category);
    const focusDomain = params.get('domain');
    if (focusDomain && snapshot.projects.some((p) => p.domains.includes(focusDomain)))
      setDomain(focusDomain);
    if (params.get('mode') === 'levers') setView('actions');
  }, [byProject, snapshot.projects]);

  const projects = useMemo(
    () =>
      snapshot.projects
        .filter(
          (p) =>
            (!projectFilter || p.id === projectFilter) &&
            (scope === 'all' || (scope === 'internal' ? p.internal : !p.internal)) &&
            (domain === 'all' || p.domains.includes(domain)) &&
            (!query ||
              [p.name, p.segment, ...p.domains]
                .join(' ')
                .toLowerCase()
                .includes(query.toLowerCase()))
        )
        .sort(
          (a, b) =>
            priority[byLever.get(a.bestNextLeverId)!.priority] -
              priority[byLever.get(b.bestNextLeverId)!.priority] || a.name.localeCompare(b.name)
        ),
    [snapshot, scope, domain, query, projectFilter, byLever]
  );
  const actions = orderedLevers.filter((l) => {
    const p = byProject.get(l.projectId)!;
    return (
      (!projectFilter || p.id === projectFilter) &&
      (scope === 'all' || (scope === 'internal' ? p.internal : !p.internal)) &&
      (domain === 'all' || p.domains.includes(domain)) &&
      (!query ||
        [p.name, ...p.domains, l.title, l.action]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (area === 'all' || l.category === area) &&
      (status === 'scope'
        ? l.kind === 'scope'
        : l.kind === 'action' &&
          (status === 'all' || (workspace.progress[l.id]?.status ?? 'queued') === status))
    );
  });
  const matchingFallback =
    view === 'actions'
      ? actions[0]?.id
      : projects[0] &&
        (isCategory(area) ? `${projects[0].id}:${area}` : projects[0].bestNextLeverId);
  const hasFocus =
    query ||
    projectFilter ||
    scope !== 'all' ||
    area !== 'all' ||
    domain !== 'all' ||
    status !== 'all';
  const defaultSelection = hasFocus ? matchingFallback : (active?.leverId ?? matchingFallback);
  const lever = byLever.get(selected) ?? byLever.get(defaultSelection ?? fallback)!;
  const selectedProject = byProject.get(lever.projectId)!;
  const hasMatches = view === 'scores' ? projects.length > 0 : actions.length > 0;
  const scores = snapshot.projects.flatMap((p) => Object.values(p.scores));
  const assessed = scores.filter((s) => s.status === 'estimated');
  const exempt = scores.filter((s) => s.status === 'not_applicable').length;
  const unknown = scores.filter((s) => s.status === 'unknown').length;
  const provisional = assessed.filter((s) => s.confidence === 'low').length;
  const domains = [...new Set(snapshot.projects.flatMap((p) => p.domains))].sort();

  function choose(l: Lever) {
    setSelected(l.id);
  }
  function selectScore(p: ScoreProject, category: (typeof SCORE_CATEGORIES)[number]) {
    choose(byLever.get(`${p.id}:${category}`)!);
    setSheet('evidence');
  }
  async function copyFocus() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({
      view: 'scoreboard',
      mode: 'levers',
      project: lever.projectId,
      category: lever.category,
      ...(domain !== 'all' && { domain }),
    }).toString();
    try {
      await navigator.clipboard.writeText(url.href);
      setNotice('Focus link copied. Opening it requires your private review on that device.');
    } catch {
      setNotice(`Copy this focus link: ${url.href}`);
    }
  }
  function resetFilters() {
    setQuery('');
    setScope('all');
    setArea('all');
    setDomain('all');
    setProjectFilter('');
    setStatus('all');
    setSort([]);
    setSelected('');
  }

  const columns: DataColumn<ScoreProject>[] = [
    {
      id: 'name',
      header: 'Product',
      value: (p) => p.name,
      hideable: false,
      minWidth: '10rem',
      cell: (p) => (
        <span className={styles.productCell}>
          <strong>{p.name}</strong>
          <small>{p.internal ? 'Internal utility' : p.domains[0]}</small>
        </span>
      ),
    },
    ...SCORE_CATEGORIES.filter((c) => area === 'all' || area === c).map((c) => ({
      id: c,
      header: short[c],
      value: (p: ScoreProject) => p.scores[c].value,
      align: 'right' as const,
      sortDescFirst: false,
      minWidth: '7rem',
      cell: (p: ScoreProject) => (
        <button
          className={styles.scoreButton}
          aria-label={`${p.name}: ${CATEGORY_LABELS[c]} evidence`}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            selectScore(p, c);
          }}
        >
          <span className={styles.scoreWithChange}>
            <Value score={p.scores[c]} />
            {reviews.length > 1 && <ScoreDelta change={changeById.get(`${p.id}:${c}`)} />}
          </span>
        </button>
      ),
    })),
    {
      id: 'total',
      header: 'Total',
      sortDescFirst: false,
      align: 'right',
      value: sortableTotal,
      cell: (p) => {
        const t = scoreTotal(p);
        return (
          <span
            className={styles.total}
            title={`${t.unknown} unassessed · ${t.exempt} exempt · ${t.knownMax} assessed points`}
          >
            {formatScore(t.sum)}
            <small>{t.complete ? ` / ${t.maximum}` : ' known'}</small>
          </span>
        );
      },
    },
  ];
  const actionColumns: DataColumn<Lever>[] = [
    {
      id: 'priority',
      header: 'Priority',
      value: (l) => priority[l.priority],
      minWidth: '5rem',
      cell: (l) => (
        <span className={`${styles.priority} ${l.priority === 'critical' ? styles.critical : ''}`}>
          {l.priority}
        </span>
      ),
    },
    {
      id: 'project',
      header: 'Product',
      value: (l) => byProject.get(l.projectId)!.name,
      minWidth: '9rem',
      cell: (l) => (
        <strong className={styles.actionProduct}>{byProject.get(l.projectId)!.name}</strong>
      ),
    },
    { id: 'area', header: 'Area', value: (l) => short[l.category], minWidth: '6rem' },
    {
      id: 'score',
      header: 'Score',
      value: (l) => byProject.get(l.projectId)!.scores[l.category].value,
      sortDescFirst: false,
      cell: (l) => <Value score={byProject.get(l.projectId)!.scores[l.category]} />,
    },
    {
      id: 'action',
      header: 'Next change',
      value: (l) => l.title,
      hideable: false,
      minWidth: '16rem',
      className: 'whitespace-normal',
      cell: (l) => (
        <span className={styles.actionCell}>
          {l.title}
          <small>{firstSentence(l.action)}</small>
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      value: (l) =>
        l.kind === 'scope' ? 'Exempt' : statusLabel[workspace.progress[l.id]?.status ?? 'queued'],
      minWidth: '7rem',
    },
  ];
  const inspector = (
    <LeverInspector
      key={`${lever.id}:${lever.followsCycleId ?? 'baseline'}`}
      workspace={workspace}
      lever={lever}
      onChange={onChange}
      onEvidence={() => setSheet('evidence')}
      onSelect={(id) => {
        setSelected(id);
      }}
    />
  );

  return (
    <div className={styles.workbench}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Product quality</div>
          <h1>Product scoreboard</h1>
          <p>Compare products and open the next fix, with its evidence.</p>
        </div>
        <button
          className={styles.reviewButton}
          onClick={() => setSheet('review')}
          aria-label="Review details, import and export"
        >
          <FileText size={16} />
          <span>
            {dateLabel(snapshot.assessedAt)} review
            <small>
              {snapshot.projects.length} products · {assessed.length} scored
            </small>
          </span>
        </button>
      </header>
      {(active || waiting.length > 0) && (
        <div className={styles.cadence} aria-label="One lever cadence">
          {active ? (
            <button
              onClick={() => {
                setSelected(active.leverId);
                setSheet('action');
              }}
            >
              <span className={styles.activeDot} />
              Active · {byProject.get(byLever.get(active.leverId)!.projectId)!.name}
              <strong>{active.plan.title}</strong>
              <ArrowUpRight size={14} />
            </button>
          ) : (
            <span>No active lever. Choose the next ready change.</span>
          )}
          {waiting.length > 0 && (
            <button
              onClick={() => {
                setView('actions');
                setStatus('awaiting_evidence');
                setQuery('');
                setScope('all');
                setDomain('all');
                setArea('all');
                setProjectFilter('');
              }}
            >
              {waiting.length} awaiting evidence
            </button>
          )}
        </div>
      )}
      <div className={styles.tabs}>
        <div>
          <button
            aria-pressed={view === 'scores'}
            onClick={() => {
              setView('scores');
              setStatus('all');
            }}
          >
            Scores <span>{projects.length}</span>
          </button>
          <button aria-pressed={view === 'actions'} onClick={() => setView('actions')}>
            Next levers <span>{actions.length}</span>
          </button>
          <button aria-pressed={view === 'history'} onClick={() => setView('history')}>
            History <span>{reviews.length + workspace.history.length}</span>
          </button>
        </div>
        <span>5 competitive · 7.5 among the best · target {formatScore(snapshot.target)}</span>
      </div>
      {view !== 'history' && (
        <>
          <div className={styles.tools}>
            <label className={styles.search}>
              <Search size={15} />
              <input
                aria-label="Search products or domains"
                placeholder={
                  view === 'actions'
                    ? 'Find a product, domain or fix…'
                    : 'Find a product or domain…'
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected('');
                }}
              />
            </label>
            <select
              aria-label="Scope"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setSelected('');
              }}
            >
              <option value="all">All products</option>
              <option value="products">Public products</option>
              <option value="internal">Internal tools</option>
            </select>
            <select
              aria-label="Area"
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setSelected('');
                setSort(e.target.value === 'all' ? [] : [{ id: e.target.value, desc: false }]);
              }}
            >
              <option value="all">All six areas</option>
              {SCORE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select
              aria-label="Domain"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setSelected('');
              }}
            >
              <option value="all">All domains</option>
              {domains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          {(query ||
            scope !== 'all' ||
            area !== 'all' ||
            domain !== 'all' ||
            projectFilter ||
            status !== 'all') && (
            <div className={styles.filterSummary}>
              <span>
                {projectFilter ? `Product: ${byProject.get(projectFilter)?.name} · ` : ''}
                {view === 'scores'
                  ? `${projects.length} products`
                  : `${actions.length} recommendations`}{' '}
                match
              </span>
              <button onClick={resetFilters}>
                <RotateCcw size={12} />
                Reset filters
              </button>
            </div>
          )}
          {view === 'actions' && (
            <label className={styles.statusFilter}>
              Status{' '}
              <select
                aria-label="Lever status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setSelected('');
                }}
              >
                <option value="all">All actions</option>
                {Object.entries(statusLabel).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
                <option value="scope">Scope decisions</option>
              </select>
            </label>
          )}
          <div
            className={styles.compareGrid}
            style={hasMatches ? undefined : { gridTemplateColumns: 'minmax(0, 1fr)' }}
          >
            <div className={`${styles.tablePane} ${view === 'scores' ? styles.scoreTable : ''}`}>
              {view === 'scores' && (
                <div className={styles.comparisonContext}>
                  {reviews.length > 1 ? (
                    <label>
                      Change since{' '}
                      <select
                        aria-label="Score baseline"
                        value={baseline.id}
                        onChange={(e) => setBaselineId(e.target.value)}
                      >
                        {reviews.map((r, i) => (
                          <option key={r.id} value={r.id}>
                            {dateLabel(r.assessedAt)} · {i + 1}. {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span>Baseline saved · {dateLabel(snapshot.assessedAt)}</span>
                  )}
                  <button onClick={() => setView('history')}>
                    View score history <ArrowUpRight size={12} />
                  </button>
                </div>
              )}
              {view === 'scores' ? (
                <DataTable
                  key={`scores:${area}`}
                  data={projects}
                  columns={columns}
                  getRowId={(p) => p.id}
                  label="Compare product scores"
                  selectedId={selectedProject.id}
                  onRowClick={(p) => choose(byLever.get(p.bestNextLeverId)!)}
                  sort={sort}
                  onSortChange={setSort}
                  maxHeight="min(65dvh, 46rem)"
                />
              ) : (
                <DataTable
                  key="actions"
                  data={actions}
                  columns={actionColumns}
                  getRowId={(l) => l.id}
                  label="Next lever queue"
                  selectedId={lever.id}
                  onRowClick={choose}
                  maxHeight="min(65dvh, 46rem)"
                />
              )}
              <p className={styles.tableFoot}>
                ◦ Provisional estimate
                <span>
                  Total sorts by displayed points; each maximum stays visible. Unassessed totals
                  sort last. Click again to reverse sorting.
                </span>
              </p>
            </div>
            {hasMatches && (
              <aside className={styles.desktopInspector} aria-label="Selected next lever">
                {inspector}
              </aside>
            )}
          </div>
          {hasMatches && (
            <button className={styles.mobileOpen} onClick={() => setSheet('action')}>
              <span>
                <small>Selected lever · {selectedProject.name}</small>
                {lever.title}
              </span>
              <ChevronRight size={20} />
            </button>
          )}
        </>
      )}
      {view === 'history' && (
        <>
          <ScoreHistory workspace={workspace} reviews={reviews} onImport={onImport} />
          <details className={styles.outcomeDisclosure}>
            <summary>Lever outcomes · {workspace.history.length} recorded steps</summary>
            <section className={styles.history} aria-label="Outcome history">
              <h2>Lever outcomes</h2>
              <p>
                Plans and proof stay in history. Verification does not automatically raise a score.
              </p>
              {workspace.history.length === 0 ? (
                <div className={styles.empty}>
                  No cycles yet. Select a lever and choose “Pick this lever”.
                </div>
              ) : (
                [...workspace.history].reverse().map((record) => (
                  <article key={record.id}>
                    <div className={styles.historyHeading}>
                      <h3>{record.plan.title}</h3>
                      <span className={styles.priority}>{statusLabel[record.status]}</span>
                    </div>
                    <p className={styles.eyebrow}>
                      {record.leverId} · {dateLabel(record.at)} · baseline{' '}
                      {record.plan.baselineScore === null
                        ? 'Unassessed'
                        : `${formatScore(record.plan.baselineScore)}/10`}
                    </p>
                    {record.result && <p className={styles.historyResult}>{record.result}</p>}
                    {record.evidence && <p>Evidence: {record.evidence}</p>}
                    {record.outcome && <p>Outcome: {record.outcome}</p>}
                    {record.prerequisiteSatisfied && <p>Prerequisite objective accepted.</p>}
                    <details>
                      <summary>Original action and finish line</summary>
                      <p>{record.plan.action}</p>
                      <p>Done when: {record.plan.proof}</p>
                    </details>
                  </article>
                ))
              )}
            </section>
          </details>
        </>
      )}
      <footer className={styles.workspaceFooter}>
        <button onClick={() => setSheet('review')}>
          {saved ? 'Saved on this device' : 'Unsaved · export now'} · review & backup
        </button>
        <button onClick={() => void copyFocus()}>
          <Link size={12} />
          Copy selected focus
        </button>
      </footer>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
      >
        <SheetContent className={`${styles.sheet} ${styles.workbench}`}>
          <SheetHeader>
            <SheetTitle>
              {sheet === 'evidence'
                ? 'Evidence behind this score'
                : sheet === 'review'
                  ? 'Review & backup'
                  : 'The next change'}
            </SheetTitle>
            <SheetDescription>
              {sheet === 'review'
                ? snapshot.label
                : `${selectedProject.name} · ${CATEGORY_LABELS[lever.category]}`}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {sheet === 'action' ? (
              inspector
            ) : sheet === 'review' ? (
              <div className={styles.reviewDetails}>
                <h2>
                  {assessed.length} areas scored.
                  <br />
                  {provisional} provisional estimates.
                </h2>
                <p>
                  {snapshot.projects.length} products · {snapshot.levers.length} category
                  recommendations · assessed {dateLabel(snapshot.assessedAt)}.
                </p>
                <p>
                  {exempt} areas are exempt from their product’s scope. {unknown} are unassessed.
                  Six applicable scores total 60; exemptions reduce the denominator. Partial totals
                  contain only known scores.
                </p>
                <p>
                  5 means competitive. 7.5 means among the best in the stated segment. The target is{' '}
                  {formatScore(snapshot.target)}/10. Low confidence describes evidence, not
                  automatically poor quality. GEO readiness does not prove AI recommendation share.
                </p>
                <h3>The six categories</h3>
                <dl className={styles.categoryDefinitions}>
                  {SCORE_CATEGORIES.map((c) => (
                    <div key={c}>
                      <dt>{CATEGORY_LABELS[c]}</dt>
                      <dd>{CATEGORY_DESCRIPTIONS[c]}</dd>
                    </div>
                  ))}
                </dl>
                <h3>One lever at a time</h3>
                <p>
                  Pick a change, collect proof, then record the outcome. Waiting for evidence frees
                  the active slot. Verified or parked work can receive a follow-up; the original
                  plan stays in history. Only a reviewed assessment changes a score. Every imported
                  assessment is retained in score history.
                </p>
                <p>
                  For design, observe comprehension, friction, delight and preference in the actual
                  core workflow. A numeric checklist alone does not establish excellent design.
                </p>
                <h3>Your private workspace</h3>
                <p>
                  {saved
                    ? 'Saved on this device.'
                    : 'Changes are only in this tab. Export before closing it.'}{' '}
                  Review data is not uploaded. Dated assessments and their evidence are saved in
                  browser history storage and included in every backup. This browser and signed-in
                  account have their own workspace; other devices do not sync. Export after a review
                  session.
                </p>
                <div className={styles.backupActions}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSheet(null);
                      onImport();
                    }}
                  >
                    <Upload size={15} />
                    Import review
                  </Button>
                  <Button onClick={onExport}>
                    <Download size={15} />
                    Export backup
                  </Button>
                </div>
              </div>
            ) : (
              <ScoreEvidence
                project={selectedProject}
                score={selectedProject.scores[lever.category]}
              />
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LeverInspector({
  workspace,
  lever,
  onChange,
  onEvidence,
  onSelect,
}: {
  workspace: ScoreWorkspace;
  lever: Lever;
  onChange: (fn: (current: ScoreWorkspace) => ScoreWorkspace) => void;
  onEvidence: () => void;
  onSelect: (id: string) => void;
}) {
  const project = workspace.snapshot.projects.find((p) => p.id === lever.projectId)!;
  const score = project.scores[lever.category];
  const state = workspace.progress[lever.id]?.status ?? 'queued';
  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorMeta}>
        <span>
          {project.name}
          <ChevronRight size={12} />
          {short[lever.category]}
        </span>
        <span
          className={`${styles.priority} ${lever.priority === 'critical' ? styles.critical : ''}`}
        >
          {lever.kind === 'scope' ? 'Scope' : lever.priority}
        </span>
      </div>
      <h2>{lever.title}</h2>
      <div className={styles.baseline}>
        <Value score={score} />
        {score.status === 'estimated' && <span>/10 now</span>}
        <span className={styles.baselineDivider} />
        <span>{score.confidence === 'low' ? 'Provisional' : `${score.confidence} confidence`}</span>
        <button onClick={onEvidence}>
          See evidence
          <ArrowUpRight size={13} />
        </button>
      </div>
      <div className={styles.changeGrid}>
        <section>
          <div className={styles.eyebrow}>
            {lever.kind === 'scope' ? 'Scope decision' : 'Change'}
          </div>
          <p>{firstSentence(lever.action)}</p>
        </section>
        <section>
          <div className={styles.eyebrow}>
            <Check size={13} />
            {lever.kind === 'scope' ? 'Preserve when' : 'Done when'}
          </div>
          {lever.proof.split(/(?<=[.!?])\s+(?=[A-Z])/u).length > 1 ? (
            <ul className={styles.finishLine}>
              {lever.proof.split(/(?<=[.!?])\s+(?=[A-Z])/u).map((criterion, index) => (
                <li key={`${index}:${criterion}`}>{criterion}</li>
              ))}
            </ul>
          ) : (
            <p>{lever.proof}</p>
          )}
        </section>
      </div>
      <details className={styles.fullDetails}>
        <summary>Why this matters & full recommendation</summary>
        <p>{lever.why}</p>
        <p>{lever.action}</p>
      </details>
      {lever.dependencies.length > 0 && (
        <div className={styles.dependencies}>
          <span>Prerequisites</span>
          {lever.dependencies.map((id) => (
            <button key={id} onClick={() => onSelect(id)}>
              <Check
                size={12}
                className={prerequisiteSatisfied(workspace, id) ? '' : styles.unaccepted}
              />
              {workspace.snapshot.levers.find((l) => l.id === id)!.title}
              <ArrowUpRight size={12} />
            </button>
          ))}
        </div>
      )}
      {lever.kind === 'action' && (
        <LeverWorkflow
          key={`${lever.id}:${lever.followsCycleId ?? 'baseline'}`}
          workspace={workspace}
          lever={lever}
          onChange={onChange}
          onSelect={onSelect}
        />
      )}
      {lever.kind === 'scope' && (
        <p className={styles.scopeNote}>
          Exempt from acquisition goals. This decision is retained without a score penalty or a
          growth task.
        </p>
      )}
      {state === 'verified' && (
        <p className={styles.scopeNote}>
          Outcome recorded. The assessment score remains unchanged.
        </p>
      )}
    </div>
  );
}

function LeverWorkflow({
  workspace,
  lever,
  onChange,
  onSelect,
}: {
  workspace: ScoreWorkspace;
  lever: Lever;
  onChange: (fn: (current: ScoreWorkspace) => ScoreWorkspace) => void;
  onSelect: (id: string) => void;
}) {
  const progress = workspace.progress[lever.id];
  const state = progress?.status ?? 'queued';
  const active = Object.values(workspace.progress).find((p) => p?.status === 'active');
  const blocked = lever.dependencies.some((id) => !prerequisiteSatisfied(workspace, id));
  const [result, setResult] = useState(progress?.result ?? '');
  const [evidence, setEvidence] = useState(progress?.evidence ?? '');
  const [accepted, setAccepted] = useState(progress?.prerequisiteSatisfied ?? false);
  const [outcome, setOutcome] = useState<Exclude<CycleRecord['outcome'], null>>(
    progress?.outcome ?? 'learning'
  );
  const [title, setTitle] = useState('');
  const [action, setAction] = useState('');
  const [proof, setProof] = useState('');
  const record = (next: Exclude<LeverStatus, 'queued'>) =>
    onChange((current) =>
      transitionLever(current, lever.id, next, {
        result,
        evidence,
        outcome: next === 'verified' ? outcome : null,
        prerequisiteSatisfied: next === 'verified' && outcome === 'helped' && accepted,
      })
    );
  return (
    <div className={styles.workflow}>
      {(state === 'queued' || state === 'parked' || state === 'awaiting_evidence') && (
        <div className={styles.inspectorFooter}>
          <Button
            className={styles.primary}
            disabled={!!active || blocked}
            onClick={() => record('active')}
          >
            {state === 'queued' ? 'Pick this lever' : 'Resume this lever'}
            <ArrowRight size={15} />
          </Button>
          <span>
            {blocked ? (
              'Complete the prerequisites first.'
            ) : active ? (
              <button onClick={() => onSelect(active.leverId)}>
                Open the active lever to finish, wait or park it.
              </button>
            ) : (
              'One active lever at a time'
            )}
          </span>
        </div>
      )}
      {(state === 'active' || state === 'awaiting_evidence') && (
        <details className={styles.recordDetails} open={state === 'active'}>
          <summary>
            {state === 'active'
              ? 'Active · record progress or outcome'
              : 'Awaiting evidence · record an outcome'}
          </summary>
          <div className={styles.form}>
            <label>
              What changed or what did you learn?
              <textarea value={result} onChange={(e) => setResult(e.target.value)} />
            </label>
            <label>
              Evidence, date and scope
              <textarea
                value={evidence}
                placeholder="A result, test or observation with its exact scope…"
                onChange={(e) => setEvidence(e.target.value)}
              />
            </label>
            <label>
              Observed outcome
              <select
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
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                The original objective is achieved; this proof may unblock dependent levers.
              </label>
            )}
            <p>Save a progress note before leaving to retain this text.</p>
            <div className={styles.formActions}>
              <Button
                className={styles.primary}
                disabled={!result.trim() || !evidence.trim()}
                onClick={() => record('verified')}
              >
                <Check size={14} />
                Verify outcome
              </Button>
              <Button
                variant="outline"
                disabled={!result.trim()}
                onClick={() => record(state === 'active' ? 'active' : 'awaiting_evidence')}
              >
                Save progress note
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
        </details>
      )}
      {(state === 'verified' || state === 'parked') && (
        <>
          {progress?.result && (
            <div className={styles.lastResult}>
              <span className={styles.eyebrow}>
                {statusLabel[state]} · {dateLabel(progress.at)}
              </span>
              <p>{progress.result}</p>
              {progress.evidence && <p>Evidence: {progress.evidence}</p>}
            </div>
          )}
          <details className={styles.recordDetails}>
            <summary>Plan the next lever in this area</summary>
            <div className={styles.form}>
              <label>
                Next lever title
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label>
                One bounded change
                <textarea value={action} onChange={(e) => setAction(e.target.value)} />
              </label>
              <label>
                What evidence would close it?
                <textarea value={proof} onChange={(e) => setProof(e.target.value)} />
              </label>
              <Button
                className={styles.primary}
                disabled={![title, action, proof].every((x) => x.trim())}
                onClick={() =>
                  onChange((current) => planNextLever(current, lever.id, { title, action, proof }))
                }
              >
                Queue follow-up
                <ArrowRight size={14} />
              </Button>
              <p>The previous plan and outcome stay in history. The score stays unchanged.</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
