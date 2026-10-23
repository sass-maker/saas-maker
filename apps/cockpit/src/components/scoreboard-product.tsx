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
  type ScoreCategory,
  type ScoreMetric,
  type ScoreProject,
  type ScoreWorkspace,
} from '@/lib/scoreboard';
import { ScoreValue } from './scoreboard-evidence';
import styles from './scoreboard-workbench.module.css';

export function ScoreboardProduct({
  project,
  workspace,
  onEvidence,
  onLever,
}: {
  project: ScoreProject;
  workspace: ScoreWorkspace;
  onEvidence: (category: ScoreCategory, metric: ScoreMetric) => void;
  onLever: (id: string) => void;
}) {
  const next = workspace.snapshot.levers.find((l) => l.id === project.bestNextLeverId)!;
  return (
    <article className={styles.productInfo} aria-label={`${project.name} product information`}>
      <NextLink className={styles.backLink} href="/projects?view=scoreboard">
        <ArrowLeft size={15} /> All products
      </NextLink>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            Product information · {project.internal ? 'Internal tool' : 'Public product'}
          </div>
          <h1>{project.name}</h1>
          <p>{project.segment}</p>
        </div>
        <span className={styles.priority}>{productPriorityLabel(project)}</span>
      </header>
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
