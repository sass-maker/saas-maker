import { formatScore } from '@/lib/scoreboard';
import styles from './scoreboard-workbench.module.css';

export function ScoreboardGuide({ target }: { target: number }) {
  return (
    <section className={styles.scoringGuide} aria-label="How scoring works">
      <p>
        <strong>Effort</strong> is the quality of work completed. <strong>Result</strong> is the
        outcome achieved. Each category has both scores out of 10, with two separate totals out of
        60. Open any score for its reasoning, evidence and confidence.
      </p>
      <details>
        <summary>Scoring scale, priorities & weekly review</summary>
        <div className={styles.guideGrid}>
          <div>
            <h3>The scale</h3>
            <p>
              Effort: 5 = material but incomplete work; 7.5 = well-executed, near-complete work; 10
              = sustained best-in-segment execution. Hours spent do not earn points.
            </p>
            <p>
              Result: 5 = competitive; 7.5 = among the best in the stated segment; 10 =
              demonstrated, sustained leadership. The target is {formatScore(target)}/10 in each
              category.
            </p>
          </div>
          <div>
            <h3>Read the evidence</h3>
            <p>
              Unknown is missing evidence, never zero. Exempt categories reduce the denominator:
              four applicable areas total 40. Partial totals show known points without estimating
              missing outcomes. ◦ marks a provisional, low-confidence estimate.
            </p>
            <p>
              Design needs observed comprehension, friction, delight and preference in the real
              workflow. A checklist or a screenshot alone cannot prove a great experience.
            </p>
          </div>
          <div>
            <h3>Choose work, then review weekly</h3>
            <p>
              Learning / skill and Commercial / attention bets receive Focus priority. Other
              classified products have Standard priority. I use it is an overlapping purpose label.
              Purpose describes owner intent; priority sets the order of work. Neither is a quality
              or revenue score.
            </p>
            <p>
              Complete the chosen task, record the work and outcome separately, then update this
              report in the weekly review. Only new evidence changes a score. Waiting on users or an
              observation window stays an explicit task, with its finish line.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
