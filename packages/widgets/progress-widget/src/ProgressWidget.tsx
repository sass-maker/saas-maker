import { useEffect, useMemo, useState } from 'react';
import type { ChangelogEntryRecord, ProgressWidgetProps, RoadmapItemRecord } from '@saas-maker/shared-types';
import { createApiClient } from './api';
import './styles/progress.css';

const ROADMAP_COLUMNS = ['in_progress', 'planned', 'done'] as const;

const COLUMN_LABELS: Record<(typeof ROADMAP_COLUMNS)[number], string> = {
  in_progress: 'In Progress',
  planned: 'Planned',
  done: 'Shipped',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getColumnItems(items: RoadmapItemRecord[], column: RoadmapItemRecord['column']) {
  return items
    .filter((item) => item.column === column)
    .sort((a, b) => a.position - b.position || b.upvote_count - a.upvote_count);
}

function ChangelogList({ entries, showEmptyStates }: { entries: ChangelogEntryRecord[]; showEmptyStates: boolean }) {
  if (entries.length === 0) {
    return showEmptyStates ? <p className="smp-empty">No shipped updates yet.</p> : null;
  }

  return (
    <ol className="smp-changelog">
      {entries.map((entry) => (
        <li key={entry.id} className="smp-changelog-item">
          <div className="smp-changelog-meta">
            <span>{formatDate(entry.published_at || entry.created_at)}</span>
            <span className={`smp-badge smp-badge--${entry.type}`}>{entry.type}</span>
            {entry.version && <span className="smp-version">v{entry.version}</span>}
          </div>
          <h4>{entry.title}</h4>
          <p>{entry.content}</p>
        </li>
      ))}
    </ol>
  );
}

function RoadmapColumn({
  label,
  items,
  showEmptyStates,
}: {
  label: string;
  items: RoadmapItemRecord[];
  showEmptyStates: boolean;
}) {
  return (
    <section className="smp-roadmap-column">
      <div className="smp-column-header">
        <h4>{label}</h4>
        <span>{items.length}</span>
      </div>
      {items.length === 0 && showEmptyStates ? (
        <p className="smp-empty smp-empty--compact">Nothing here yet.</p>
      ) : (
        <div className="smp-roadmap-items">
          {items.map((item) => (
            <article key={item.id} className="smp-roadmap-item">
              <div>
                <h5>{item.title}</h5>
                {item.description && <p>{item.description}</p>}
              </div>
              {item.upvote_count > 0 && <span className="smp-votes">{item.upvote_count}</span>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProgressWidget({
  slug,
  apiBaseUrl,
  theme = 'auto',
  maxChangelogItems,
  showEmptyStates = true,
}: ProgressWidgetProps) {
  const [data, setData] = useState<{
    projectName: string;
    changelog: ChangelogEntryRecord[];
    roadmap: RoadmapItemRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const api = useMemo(() => createApiClient(apiBaseUrl), [apiBaseUrl]);
  const themeClass = theme === 'light' ? 'smp--light' : theme === 'dark' ? 'smp--dark' : 'smp--auto';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPublicProgress(slug, maxChangelogItems)
      .then((result) => {
        if (!cancelled && result) {
          setData({
            projectName: result.project.name,
            changelog: result.changelog,
            roadmap: result.roadmap,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, maxChangelogItems, slug]);

  if (loading) return null;
  if (!data) {
    return showEmptyStates ? (
      <div data-saasmaker-progress="" className={themeClass}>
        <p className="smp-empty">Progress is not available.</p>
      </div>
    ) : null;
  }

  return (
    <div data-saasmaker-progress="" className={themeClass}>
      <header className="smp-header">
        <p>Progress</p>
        <h3>{data.projectName}</h3>
      </header>

      <div className="smp-layout">
        <section className="smp-section">
          <div className="smp-section-header">
            <h3>Now and Next</h3>
          </div>
          <div className="smp-roadmap">
            {ROADMAP_COLUMNS.map((column) => (
              <RoadmapColumn
                key={column}
                label={COLUMN_LABELS[column]}
                items={getColumnItems(data.roadmap, column)}
                showEmptyStates={showEmptyStates}
              />
            ))}
          </div>
        </section>

        <section className="smp-section">
          <div className="smp-section-header">
            <h3>Shipped</h3>
          </div>
          <ChangelogList entries={data.changelog} showEmptyStates={showEmptyStates} />
        </section>
      </div>
    </div>
  );
}
