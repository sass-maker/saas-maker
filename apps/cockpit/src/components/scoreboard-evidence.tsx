import { ArrowUpRight, ChevronRight, FileText } from 'lucide-react';
import { formatScore, safeEvidenceUrl, type Score, type ScoreProject } from '@/lib/scoreboard';
import styles from './scoreboard-workbench.module.css';
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export function ScoreValue({ score }: { score: Score }) {
  return (
    <span
      className={`${styles.score} ${score.value !== null && score.value < 5 ? styles.weak : ''}`}
    >
      {score.value === null ? (
        <span className={styles.exempt}>
          {score.status === 'not_applicable' ? 'Exempt' : 'Unassessed'}
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

export function ScoreEvidence({ project, score }: { project: ScoreProject; score: Score }) {
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
