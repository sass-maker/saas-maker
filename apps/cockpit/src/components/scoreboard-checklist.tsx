import { ArrowUpRight } from 'lucide-react';
import styles from './scoreboard-workbench.module.css';

const categoryGuidance = [
  {
    title: 'Product & feature parity',
    effort:
      'Complete the promised core workflow, useful result, and recovery against relevant alternatives.',
    result:
      'Observe whether the intended audience completes the task and receives the promised value.',
  },
  {
    title: 'Design & delight',
    effort:
      'Review the rendered journey, accessible states, comprehension, friction, and recovery.',
    result:
      'Use observed preference and task success; a screenshot or checklist alone is not an outcome.',
  },
  {
    title: 'SEO & growth',
    effort:
      'Research audience intent, maintain useful owned pages, and qualify third-party profiles and distribution.',
    result:
      'Measure indexing, unique owned URLs in top-20 results, and non-QA referral conversions.',
  },
  {
    title: 'GEO & AI visibility',
    effort:
      'Keep factual profiles and answer-ready evidence current; run a versioned set of real audience questions.',
    result:
      'Record observed citations, separating controlled placements from independent editorial citations, recommendation accuracy, and attributable useful referrals.',
  },
  {
    title: 'Measurement & learning',
    effort:
      'Collect reliable, privacy-appropriate signals and keep dates, coverage, and limits explicit.',
    result: 'Show a dated signal → decision → action → comparable follow-up result.',
  },
  {
    title: 'Engineering & operations',
    effort:
      'Verify correctness, performance, privacy, reliability, and recovery in intended runtimes.',
    result:
      'Measure shipped-runtime behavior and useful service outcomes; tooling presence alone proves neither.',
  },
] as const;

function EvidenceLink({ href, children }: { href: string; children: string }) {
  return (
    <a className={styles.checklistLink} href={href} target="_blank" rel="noopener noreferrer">
      {children} <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}

export function ScoreboardChecklist() {
  return (
    <section className={styles.checklist} aria-labelledby="scoreboard-checklist-title">
      <header className={styles.checklistHeader}>
        <div>
          <p className={styles.eyebrow}>Guidance · no automatic scoring</p>
          <h2 id="scoreboard-checklist-title">Product checklist</h2>
          <p>
            Keep Effort and Result separate in all six categories. This reference does not tick
            readiness, change imported scores, or turn missing evidence into zero.
          </p>
        </div>
        <EvidenceLink href="https://github.com/sass-maker/saas-maker/blob/main/tooling/docs/new-project-checklist.md">
          Full Fleet checklist
        </EvidenceLink>
      </header>

      <div className={styles.checklistGrid}>
        {categoryGuidance.map((category) => (
          <article className={styles.checklistCard} key={category.title}>
            <h3>{category.title}</h3>
            <dl>
              <div>
                <dt>Effort</dt>
                <dd>{category.effort}</dd>
              </div>
              <div>
                <dt>Result</dt>
                <dd>{category.result}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <section className={styles.distributionChecklist} aria-labelledby="distribution-title">
        <header>
          <p className={styles.eyebrow}>Public growth where intended</p>
          <h3 id="distribution-title">Third-party profiles & content distribution</h3>
          <p>
            Choose relevant, legitimate platforms for the audience and the product. Keep public
            profiles accurate, make each contribution useful on its destination, and record a
            publication or indexing receipt as evidence of work—not proof of traffic or ranking.
          </p>
        </header>
        <div className={styles.distributionColumns}>
          <div>
            <h4>SEO & growth · effort</h4>
            <ul>
              <li>
                Qualify platforms by audience fit, editorial standards, cost, and submission terms.
              </li>
              <li>
                Keep brand, product, canonical URL, description, and category accurate on selected
                profiles.
              </li>
              <li>
                Publish original or meaningfully adapted material on relevant channels; log each
                destination, URL, date, and submission/index receipt.
              </li>
              <li>
                Before every public post, run the Humanizer skill. If it is not listed with
                advertised skills, check the managed install at
                ~/.local/share/agent-config/skills/humanizer/SKILL.md. Check factual claims, links,
                and disclosures, and retain the final copy revision. If the skill cannot be loaded,
                hold that post and report the missing step.
              </li>
            </ul>
            <h4>SEO & growth · result</h4>
            <ul>
              <li>
                Check changed owned URLs in Search Console and record first-observed index state,
                selected canonical, and evidence time; this is not the exact index event time. For
                external profiles, use evidence available from the relevant engine or destination.
              </li>
              <li>
                Count unique owned URLs appearing in the top 20 for a fixed query set; keep query,
                engine, date, and position.
              </li>
              <li>
                Measure non-QA referral visits that complete a useful conversion over a stated
                window.
              </li>
            </ul>
          </div>
          <div>
            <h4>GEO & AI visibility · effort</h4>
            <ul>
              <li>
                Keep brand-controlled third-party profiles and contributed facts consistent with
                verifiable owned evidence and known product limits; these placements are effort, not
                independent citation outcomes.
              </li>
              <li>
                Run the same versioned audience questions across named answer engines; retain date,
                query, and citation URLs.
              </li>
              <li>
                Inspect any cited third-party page when the product is absent or misrepresented
                before choosing an edit.
              </li>
            </ul>
            <h4>GEO & AI visibility · result</h4>
            <ul>
              <li>
                Record citations to brand-authored URLs as distribution results, separately from
                independent editorial citations and accurate recommendations. A placement alone is
                effort.
              </li>
              <li>
                Track attributable AI referrals and useful conversions; absence of referral tracking
                remains unknown.
              </li>
              <li>
                Repeat a comparable observation after a stated window. A 24-hour check is one
                timestamp, never an indexing or citation guarantee.
              </li>
            </ul>
          </div>
        </div>
        <p className={styles.checklistBoundary}>
          Internal, private, and local products may mark public distribution not applicable with a
          reason. Do not expose their URLs or force a public listing. Missing observations stay
          unknown; publishing and submission are effort. Impressions and screenshots can document
          discovery or a visible result, but do not establish qualified use or growth on their own.
        </p>
        <div className={styles.checklistResources}>
          <EvidenceLink href="https://github.com/sass-maker/saas-maker/blob/main/tooling/skills/distributed-brand-search/SKILL.md">
            Third-party brand discovery & distribution
          </EvidenceLink>
          <EvidenceLink href="https://github.com/sass-maker/saas-maker/blob/main/tooling/skills/distributed-brand-search/references/platform-study.md">
            Platform study
          </EvidenceLink>
          <EvidenceLink href="https://github.com/sass-maker/saas-maker/blob/main/tooling/skills/seo-research/SKILL.md">
            SEO research workflow
          </EvidenceLink>
          <EvidenceLink href="https://github.com/sass-maker/saas-maker/blob/main/tooling/skills/agent-ready/SKILL.md">
            AI and agent readiness
          </EvidenceLink>
        </div>
      </section>
    </section>
  );
}
