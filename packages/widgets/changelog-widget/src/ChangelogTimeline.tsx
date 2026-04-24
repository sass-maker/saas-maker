import React, { useEffect, useMemo, useState } from 'react';
import type { ChangelogTimelineProps } from './types';
import { createApiClient, ChangelogEntryData } from './api';
import './styles/changelog.css';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const ChangelogTimeline: React.FC<ChangelogTimelineProps> = ({
  projectId,
  apiBaseUrl,
  theme = 'auto',
  maxItems,
}) => {
  const [entries, setEntries] = useState<ChangelogEntryData[]>([]);
  const [loading, setLoading] = useState(true);

  const api = useMemo(() => createApiClient(projectId, apiBaseUrl), [projectId, apiBaseUrl]);
  const themeClass = theme === 'light' ? 'smw-cl--light' : theme === 'dark' ? 'smw-cl--dark' : 'smw-cl--auto';

  useEffect(() => {
    api.list(maxItems).then((data) => {
      setEntries(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api, maxItems]);

  if (loading) return null;

  if (entries.length === 0) {
    return (
      <div data-saasmaker-changelog="" className={themeClass}>
        <div className="smw-cl-empty">No changelog entries yet.</div>
      </div>
    );
  }

  return (
    <div data-saasmaker-changelog="" className={themeClass}>
      <div className="smw-cl-timeline">
        {entries.map((entry) => (
          <div key={entry.id} className="smw-cl-entry">
            <div className={`smw-cl-dot smw-cl-dot--${entry.type}`} />

            <div className="smw-cl-date">
              {formatDate(entry.published_at || entry.created_at)}
            </div>

            <div className="smw-cl-badges">
              {entry.version && (
                <span className="smw-cl-badge smw-cl-badge--version">
                  v{entry.version}
                </span>
              )}
              <span className={`smw-cl-badge smw-cl-badge--${entry.type}`}>
                {entry.type}
              </span>
            </div>

            <h3 className="smw-cl-title">{entry.title}</h3>
            <p className="smw-cl-content">{entry.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
