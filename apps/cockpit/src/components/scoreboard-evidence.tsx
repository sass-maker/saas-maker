'use client';

import { useState } from 'react';
import { ArrowUpRight, ChevronRight, FileText } from 'lucide-react';
import {
  formatScore,
  safeEvidenceUrl,
  scoreReading,
  type Score,
  type ScoreReading,
  type ScoreProject,
  type ScoreMetric,
} from '@/lib/scoreboard';
import styles from './scoreboard-workbench.module.css';
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export function ScoreValue({
  score,
  unknownLabel = 'Unassessed',
}: {
  score: ScoreReading;
  unknownLabel?: string;
}) {
  return (
    <span
      className={`${styles.score} ${score.value !== null && score.value < 5 ? styles.weak : ''}`}
    >
      {score.value === null ? (
        <span className={styles.exempt}>
          {score.status === 'not_applicable' ? 'Exempt' : unknownLabel}
        </span>
      ) : (
        formatScore(score.value)
      )}
      {score.confidence === 'low' && score.value !== null && (
        <span
          className={styles.uncertain}
          title="Provisional estimate"
          aria-label="Provisional estimate"
        >
          ◦
        </span>
      )}
    </span>
  );
}

export function ScorePair({ score }: { score: Score }) {
  return (
    <span className={styles.pairedScores}>
      <span>
        <small>Effort</small>
        <ScoreValue score={scoreReading(score, 'effort')} />
      </span>
      <span>
        <small>Result</small>
        <ScoreValue score={scoreReading(score, 'result')} unknownLabel="Unmeasured" />
      </span>
    </span>
  );
}

export function CategoryEvidence({
  project,
  score,
  initialMetric = 'result',
}: {
  project: ScoreProject;
  score: Score;
  initialMetric?: ScoreMetric;
}) {
  const [metric, setMetric] = useState(initialMetric);
  return (
    <div className={styles.categoryEvidence}>
      <div className={styles.evidenceMetric} aria-label="Evidence reading">
        {(['effort', 'result'] as const).map((m) => (
          <button key={m} aria-pressed={metric === m} onClick={() => setMetric(m)}>
            {m === 'effort' ? 'Effort' : 'Result'}
            <ScoreValue score={scoreReading(score, m)} unknownLabel="Unknown" />
          </button>
        ))}
      </div>
      <section>
        <h2>{metric === 'effort' ? 'Effort · work executed' : 'Result · outcome achieved'}</h2>
        <p>
          {metric === 'effort'
            ? 'Quality and completeness of the relevant work. Hours spent do not earn points.'
            : 'Observed outcomes against this category’s goal. Evidence keeps its actual date and scope.'}
        </p>
        <ScoreEvidence project={project} score={scoreReading(score, metric)} />
      </section>
      <details className={styles.legacyEvidence}>
        <summary>
          Previous combined assessment ·{' '}
          {score.value === null
            ? score.status === 'not_applicable'
              ? 'Exempt'
              : 'Unassessed'
            : `${formatScore(score.value)}/10`}
        </summary>
        <ScoreEvidence project={project} score={score} />
      </details>
    </div>
  );
}

export function ScoreEvidence({ project, score }: { project: ScoreProject; score: ScoreReading }) {
  return (
    <div className={styles.evidence}>
      <div className={styles.evidenceScore}>
        <ScoreValue score={score} />
        <span>
          {score.status === 'estimated'
            ? `/10 · ${score.confidence} confidence`
            : score.status === 'not_applicable'
              ? 'Outside this product’s scope'
              : 'Evidence needed'}
        </span>
      </div>
      <p>{score.reason}</p>
      <h3>
        Supporting evidence <span>{score.evidence.length}</span>
      </h3>
      {score.evidence.map((e, i) => {
        const url = safeEvidenceUrl(e.source);
        return (
          <details key={`${i}:${e.source}`}>
            <summary>
              <FileText size={15} />
              <span>
                {url ? new URL(url).hostname : e.source.split('/').pop()}
                <small>{dateLabel(e.date)}</small>
              </span>
              <ChevronRight size={14} />
            </summary>
            <p>{e.note}</p>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {e.source}
                <ArrowUpRight size={12} />
              </a>
            ) : (
              <code>Local evidence: {e.source}</code>
            )}
          </details>
        );
      })}
      <div className={styles.evidenceLimits}>
        <p>
          Source revision: <code>{project.sourceRevision}</code>
        </p>
        {project.limitations.map((l) => (
          <p key={l}>Limit: {l}</p>
        ))}
      </div>
    </div>
  );
}
