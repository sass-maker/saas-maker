import { useState } from 'react';
import NextLink from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import {
  CATEGORY_LABELS,
  PURPOSE_LABELS,
  SCORE_CATEGORIES,
  formatScore,
  productPriorityLabel,
  scoreReading,
  scoreTotal,
  portfolioUsageStatus,
  recordOwnerUse,
  formatUsageCount,
  type ScoreCategory,
  type ScoreMetric,
  type ScoreProject,
  type ScoreWorkspace,
  type PortfolioUsageStatus,
} from '@/lib/scoreboard';
import { ScoreValue } from './scoreboard-evidence';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import styles from './scoreboard-workbench.module.css';

const usageStatusLabel: Record<PortfolioUsageStatus, string> = {
  use_recorded: 'Use recorded',
  audience_only: 'Audience only',
  closure_review: 'Closure review',
  tracking_gap: 'Tracking gap',
  stale: 'Stale',
};
const usageUnitLabel = (unit: string) =>
  ({
    users: 'users',
    browsers: 'recognized browser IDs',
    devices: 'devices',
    sessions: 'sessions',
  })[unit as 'users' | 'browsers' | 'devices' | 'sessions'] ?? unit;
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function ScoreboardProduct({
  project,
  workspace,
  onChange,
  onEvidence,
  onLever,
}: {
  project: ScoreProject;
  workspace: ScoreWorkspace;
  onChange: (fn: (current: ScoreWorkspace) => ScoreWorkspace) => void;
  onEvidence: (category: ScoreCategory, metric: ScoreMetric) => void;
  onLever: (id: string) => void;
}) {
  const [ownerDate, setOwnerDate] = useState(localToday());
  const [ownerNote, setOwnerNote] = useState('');
  const next = workspace.snapshot.levers.find((l) => l.id === project.bestNextLeverId)!;
  const usage = workspace.usage;
  const record = usage?.records[project.id];
  const usageStatus = portfolioUsageStatus(usage, project.id);
  const now = Date.now();
  const checkedAt = record ? Date.parse(record.checkedAt) : null;
  const fresh =
    record !== undefined &&
    checkedAt !== null &&
    checkedAt <= now &&
    now - checkedAt <= 7 * 24 * 60 * 60 * 1000 &&
    Date.parse(record.windowEnd) <= now &&
    now - Date.parse(record.windowEnd) <= 7 * 24 * 60 * 60 * 1000;
  const checkedAgeDays = checkedAt === null ? null : Math.floor((now - checkedAt) / 86400000);
  return (
    <article className={styles.productInfo} aria-label={`${project.name} product information`}>
      <NextLink className={styles.backLink} href="/projects?view=scoreboard">
        <ArrowLeft size={15} /> All products
      </NextLink>
      <div className="mb-6 space-y-2">
        <p className="text-xs text-muted-foreground">
          Product information · {project.internal ? 'Internal tool' : 'Public product'}
        </p>
        <PageHeader
          className={styles.workbenchHeader}
          title={project.name}
          description={project.segment}
          action={<Badge variant="outline">{productPriorityLabel(project)}</Badge>}
        />
      </div>
      <section className={styles.productOverview} aria-label="Product purpose and scope">
        <div>
          <h2>Why we keep it</h2>
          <div className={styles.purposeTags}>
            {project.purposeCategories?.length ? (
              project.purposeCategories.map((p) => <span key={p}>{PURPOSE_LABELS[p]}</span>)
            ) : (
              <span>Owner purpose not classified</span>
            )}
          </div>
          <p>
            Learning / skill or Commercial / attention puts a product in the Focus group. Labels can
            overlap.
          </p>
        </div>
        <div>
          <h2>Domains</h2>
          {project.domains.length ? (
            project.domains.map((domain) => <p key={domain}>{domain}</p>)
          ) : (
            <p>No public domain in this review.</p>
          )}
        </div>
        <div>
          <h2>Current report</h2>
          <p>
            Assessed{' '}
            {new Date(workspace.snapshot.assessedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          {(['effort', 'result'] as const).map((metric) => {
            const total = scoreTotal(project, metric);
            return (
              <p key={metric}>
                {metric === 'effort' ? 'Effort' : 'Result'}:{' '}
                {total.knownMax ? formatScore(total.sum) : 'Unknown'} / {total.maximum}
                {total.unknown > 0 && ` · ${total.unknown} unknown`}
              </p>
            );
          })}
        </div>
      </section>
      <section className={styles.usagePanel} aria-label="Rolling 30-day usage">
        <div className={styles.usageHeading}>
          <div>
            <h2>Rolling 30-day usage</h2>
            <p>
              Audience counts are reach proxies. Only a qualified core action or a dated owner
              report records use.
            </p>
          </div>
          <Badge variant="outline">{usageStatusLabel[usageStatus]}</Badge>
        </div>
        {!record ? (
          <p>No provider report is available. Unknown usage is a tracking gap, not zero.</p>
        ) : (
          <dl className={styles.usageDetails}>
            <div>
              <dt>Audience proxy</dt>
              <dd>
                {formatUsageCount(record.proxy.count, record.proxy.precision)}{' '}
                {usageUnitLabel(record.proxy.unit)} · {record.proxy.precision.replace('_', ' ')}
              </dd>
            </div>
            <div>
              <dt>Window</dt>
              <dd>
                <code>
                  {record.windowStart} → {record.windowEnd}
                </code>
              </dd>
            </div>
            <div>
              <dt>Provider check</dt>
              <dd>
                <code>{record.checkedAt}</code> · {checkedAgeDays} days ago ·{' '}
                {fresh ? 'fresh' : 'stale'}
              </dd>
            </div>
            <div>
              <dt>Meaningful core action</dt>
              <dd>
                {record.core.definition} ·{' '}
                {formatUsageCount(record.core.count, record.core.precision)} ·{' '}
                {record.core.precision.replace('_', ' ')} · {record.core.coverage} coverage
                {' · '}
                {record.core.qualified ? 'qualified' : 'unqualified'}
                {record.core.lastUsedAt
                  ? ` · last used ${new Date(record.core.lastUsedAt).toLocaleDateString()}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Tracking health</dt>
              <dd>{record.tracking}</dd>
            </div>
          </dl>
        )}
        {record?.events?.length ? (
          <details className={styles.usageEvidence}>
            <summary>Unqualified candidate event aggregates · {record.events.length}</summary>
            {record.events.map((event) => (
              <p key={event.name}>
                {event.name}: {formatUsageCount(event.count, event.precision)} · {event.precision}
                {event.lastSeen
                  ? ` · last seen ${new Date(event.lastSeen).toLocaleDateString()}`
                  : ''}
              </p>
            ))}
          </details>
        ) : null}
        {record?.evidence.map((evidence, index) => (
          <p className={styles.usageEvidenceLine} key={`${evidence.source}:${index}`}>
            {evidence.source} · {evidence.date}: {evidence.note}
          </p>
        ))}
        {record?.limitations && <p className={styles.usageLimit}>{record.limitations}</p>}
        <form
          className={styles.ownerUseForm}
          onSubmit={(event) => {
            event.preventDefault();
            onChange((current) =>
              recordOwnerUse(current, project.id, { date: ownerDate, note: ownerNote })
            );
          }}
        >
          <label>
            Date of use
            <input
              type="date"
              value={ownerDate}
              max={localToday()}
              onChange={(event) => setOwnerDate(event.target.value)}
              required
            />
          </label>
          <label>
            Brief non-sensitive action note
            <input
              type="text"
              value={ownerNote}
              onChange={(event) => setOwnerNote(event.target.value)}
              maxLength={500}
              placeholder="What useful task did you complete?"
              required
            />
          </label>
          <p>Owner-reported, saved only in this browser, and not added to the audience proxy.</p>
          <button type="submit">Record my use</button>
        </form>
        {usage?.ownerReports?.[project.id]?.length ? (
          <details className={styles.usageEvidence}>
            <summary>Owner-reported use · {usage.ownerReports[project.id].length}</summary>
            {usage.ownerReports[project.id].map((report, index) => (
              <p key={`${report.date}:${index}`}>
                {report.date}: {report.note}
              </p>
            ))}
          </details>
        ) : null}
      </section>
      <section aria-label="Scores and next tasks">
        <h2>Six areas · evidence and next tasks</h2>
        <div className={styles.productAreas}>
          {SCORE_CATEGORIES.map((category) => {
            const lever = workspace.snapshot.levers.find(
              (l) => l.id === `${project.id}:${category}`
            )!;
            return (
              <section key={category}>
                <h3>{CATEGORY_LABELS[category]}</h3>
                <div className={styles.productReadings}>
                  {(['effort', 'result'] as const).map((metric) => (
                    <button
                      key={metric}
                      aria-label={`${CATEGORY_LABELS[category]} ${metric} evidence`}
                      onClick={() => onEvidence(category, metric)}
                    >
                      {metric === 'effort' ? 'Effort' : 'Result'}{' '}
                      <ScoreValue
                        score={scoreReading(project.scores[category], metric)}
                        unknownLabel="Unknown"
                      />
                    </button>
                  ))}
                </div>
                <button className={styles.productTask} onClick={() => onLever(lever.id)}>
                  <span>
                    {lever.id === next.id
                      ? 'Best next lever'
                      : lever.kind === 'scope'
                        ? 'Scope decision'
                        : 'Next task'}
                    <strong>{lever.title}</strong>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </section>
            );
          })}
        </div>
      </section>
      <details className={styles.scoringGuide}>
        <summary>Assessment limits</summary>
        {project.limitations.map((limit, index) => (
          <p key={`${index}:${limit}`}>{limit}</p>
        ))}
        <p>
          Source revision: <code>{project.sourceRevision}</code>
        </p>
      </details>
    </article>
  );
}
