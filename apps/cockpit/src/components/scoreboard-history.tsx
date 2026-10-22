'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Upload } from 'lucide-react';
import { type DataColumn } from '@saas-maker/ui/components/data-table';
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
  SCORE_CATEGORIES,
  compareAssessments,
  currentAssessment,
  formatScore,
  type Assessment,
  type ScoreChange,
  type ScoreWorkspace,
} from '@/lib/scoreboard';
import { ScoreEvidence, ScoreValue } from './scoreboard-evidence';
import { ScoreboardTable } from './scoreboard-table';
import styles from './scoreboard-workbench.module.css';

const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const stateLabels: Record<ScoreChange['state'], string> = {
  increased: 'Score increased',
  decreased: 'Score decreased',
  unchanged: 'Unchanged',
  newly_assessed: 'Newly assessed',
  evidence_updated: 'Evidence updated',
  scope_changed: 'Scope changed',
  added: 'Added to review',
  removed: 'Removed from review',
  unassessed: 'Now unassessed',
};

export function ScoreDelta({ change }: { change?: ScoreChange }) {
  if (!change || change.state === 'unchanged') return null;
  return (
    <span
      className={`${styles.delta} ${change.delta !== null && change.delta > 0 ? styles.positive : change.delta !== null && change.delta < 0 ? styles.negative : ''}`}
      title={stateLabels[change.state]}
    >
      {change.delta !== null && change.delta !== 0
        ? `${change.delta > 0 ? '+' : ''}${formatScore(change.delta)}`
        : stateLabels[change.state]}
    </span>
  );
}

export function ScoreHistory({
  workspace,
  reviews,
  onImport,
}: {
  workspace: ScoreWorkspace;
  reviews: Assessment[];
  onImport: () => void;
}) {
  const current = useMemo(() => currentAssessment(workspace), [workspace]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const before =
    reviews.find((r) => r.id === fromId) ?? reviews.find((r) => r.id !== current.id) ?? current;
  const after = reviews.find((r) => r.id === toId) ?? current;
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('all');
  const [domain, setDomain] = useState('all');
  const [scope, setScope] = useState('all');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [selected, setSelected] = useState<ScoreChange | null>(null);
  const [metric, setMetric] = useState<'effort' | 'result' | 'legacy'>('result');
  const all = useMemo(
    () => compareAssessments(before, after, metric === 'legacy' ? undefined : metric),
    [before, after, metric]
  );
  const rows = all.filter(
    (c) =>
      (showUnchanged || c.state !== 'unchanged') &&
      (area === 'all' || c.category === area) &&
      (scope === 'all' || (scope === 'internal' ? c.project.internal : !c.project.internal)) &&
      (domain === 'all' ||
        c.project.domains.includes(domain) ||
        c.beforeProject?.domains.includes(domain)) &&
      (!query ||
        [c.project.name, ...c.project.domains]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()))
  );
  const domains = [
    ...new Set([...before.projects, ...after.projects].flatMap((p) => p.domains)),
  ].sort();
  const numeric = all.filter((c) => c.delta !== null && c.delta !== 0).length;
  const newly = all.filter((c) => c.state === 'newly_assessed').length;
  const evidence = all.filter((c) => c.state === 'evidence_updated').length;
  const columns: DataColumn<ScoreChange>[] = [
    {
      id: 'product',
      header: 'Product',
      value: (c) => c.project.name,
      hideable: false,
      minWidth: '10rem',
      cell: (c) => (
        <span className={styles.productCell}>
          <strong>{c.project.name}</strong>
          <small>{c.project.domains[0] || 'Internal utility'}</small>
        </span>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      value: (c) => CATEGORY_LABELS[c.category],
      minWidth: '12rem',
      className: 'whitespace-normal',
    },
    {
      id: 'before',
      header: 'Before',
      value: (c) => c.before?.value ?? null,
      sortDescFirst: false,
      cell: (c) =>
        c.before ? (
          <ScoreValue score={c.before} />
        ) : (
          <span className={styles.exempt}>Not in review</span>
        ),
    },
    {
      id: 'after',
      header: 'After',
      value: (c) => c.after?.value ?? null,
      sortDescFirst: false,
      cell: (c) =>
        c.after ? (
          <ScoreValue score={c.after} />
        ) : (
          <span className={styles.exempt}>Not in review</span>
        ),
    },
    {
      id: 'change',
      header: 'Change',
      value: (c) => c.delta,
      sortDescFirst: false,
      minWidth: '10rem',
      cell: (c) =>
        c.state === 'unchanged' ? (
          <span className={styles.exempt}>Unchanged</span>
        ) : (
          <ScoreDelta change={c} />
        ),
    },
    {
      id: 'evidence',
      header: 'Evidence',
      value: (c) => c.id,
      sortable: false,
      cell: () => (
        <span className={styles.historyInspect}>
          Inspect change <ArrowUpRight size={12} />
        </span>
      ),
    },
  ];
  return (
    <section className={styles.scoreHistory} aria-label="Score history">
      <div className={styles.historyIntro}>
        <div>
          <h2>Score history</h2>
          <p>
            Compare dated assessments. A higher estimate can reflect product work or revised
            evidence; inspect the change before calling it an improvement.
          </p>
        </div>
        <Button variant="outline" onClick={onImport}>
          <Upload size={14} />
          Import an assessment
        </Button>
      </div>
      {reviews.length < 2 ? (
        <div className={styles.empty}>
          <strong>Baseline recorded · {dateLabel(current.assessedAt)}</strong>
          <p>{current.label}</p>
          <p>
            Import a later review to track improvement, or add an earlier review to score history. A
            single assessment does not establish a trend.
          </p>
        </div>
      ) : (
        <>
          <label className={styles.historyMetric}>
            Score view
            <select
              aria-label="History score view"
              value={metric}
              onChange={(e) => setMetric(e.target.value as typeof metric)}
            >
              <option value="result">Result</option>
              <option value="effort">Effort</option>
              <option value="legacy">Previous combined score</option>
            </select>
          </label>
          <p className={styles.historyFoot}>
            Effort and Result have independent histories. Older combined estimates remain available
            in “Previous combined score”; they are not reclassified as measured outcomes.
          </p>
          <div className={styles.reviewSelectors}>
            <label>
              Baseline assessment
              <select
                aria-label="Baseline assessment"
                value={before.id}
                onChange={(e) => setFromId(e.target.value)}
              >
                {reviews.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    {dateLabel(r.assessedAt)} · {i + 1}. {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compared assessment
              <select
                aria-label="Compared assessment"
                value={after.id}
                onChange={(e) => setToId(e.target.value)}
              >
                {reviews.map((r, i) => (
                  <option key={r.id} value={r.id}>
                    {dateLabel(r.assessedAt)} · {i + 1}. {r.label}
                    {r.id === current.id ? ' · current' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={styles.historyCounts}>
            {reviews.length} retained assessments · {numeric} numeric score changes · {newly} newly
            assessed · {evidence} evidence updates
          </p>
          <div className={styles.tools}>
            <label className={styles.search}>
              <Search size={15} />
              <input
                aria-label="Search score history"
                placeholder="Find a product or domain…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="History category"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="all">All six categories</option>
              {SCORE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select
              aria-label="History domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              <option value="all">All domains</option>
              {domains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              aria-label="History scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="all">All products</option>
              <option value="products">Public products</option>
              <option value="internal">Internal tools</option>
            </select>
          </div>
          <label className={styles.unchangedToggle}>
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
            />
            Show unchanged scores
          </label>
          <ScoreboardTable
            data={rows}
            columns={columns}
            getRowId={(c) => c.id}
            label="Historical score changes"
            className={styles.historyTable}
            onRowClick={setSelected}
            selectedId={selected?.id}
          />
          <p className={styles.historyFoot}>
            Unknown-to-known scores are newly assessed, not numerical gains. Exemptions and changed
            scope are excluded from numeric deltas.
          </p>
        </>
      )}
      <details className={styles.assessmentList}>
        <summary>Retained assessments · {reviews.length}</summary>
        {reviews.map((r, i) => (
          <article key={r.id}>
            <strong>
              {i + 1}. {r.label}
            </strong>
            <p>
              Assessed {dateLabel(r.assessedAt)} · retained {dateLabel(r.recordedAt)} ·{' '}
              {r.projects.length} products
            </p>
            <p>{r.note}</p>
          </article>
        ))}
      </details>
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className={`${styles.sheet} ${styles.workbench}`}>
          <SheetHeader>
            <SheetTitle>Evidence behind this change</SheetTitle>
            <SheetDescription>
              {selected && `${selected.project.name} · ${CATEGORY_LABELS[selected.category]}`}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {selected && (
              <div className={styles.changeEvidence}>
                <p className={styles.historyChangeSummary}>
                  <ScoreDelta change={selected} />
                  <span>
                    {dateLabel(before.assessedAt)} → {dateLabel(after.assessedAt)}
                  </span>
                </p>
                <section>
                  <h3>Before · {before.label}</h3>
                  <p className={styles.historyFoot}>{before.note}</p>
                  {selected.before && selected.beforeProject ? (
                    <ScoreEvidence project={selected.beforeProject} score={selected.before} />
                  ) : (
                    <p>Product was not in this assessment.</p>
                  )}
                </section>
                <section>
                  <h3>After · {after.label}</h3>
                  <p className={styles.historyFoot}>{after.note}</p>
                  {selected.after && selected.afterProject ? (
                    <ScoreEvidence project={selected.afterProject} score={selected.after} />
                  ) : (
                    <p>Product was not in this assessment.</p>
                  )}
                </section>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </section>
  );
}
