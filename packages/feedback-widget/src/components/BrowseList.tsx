import React, { useCallback, useEffect, useState } from 'react';
import type { FeedbackRecord, FeedbackType } from '@saasmaker/shared-types';
import type { ApiClient } from '../api';

interface BrowseListProps {
  api: ApiClient;
  types: FeedbackType[];
  accentColor: string;
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  feedback: 'Feedback',
};

const UpvoteIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

function SkeletonItem() {
  return (
    <div className="smw-browse-item smw-browse-item--skeleton">
      <div className="smw-browse-item__upvote">
        <div className="smw-skeleton smw-skeleton--circle" />
        <div className="smw-skeleton smw-skeleton--xs" />
      </div>
      <div className="smw-browse-item__content">
        <div className="smw-skeleton smw-skeleton--badge" />
        <div className="smw-skeleton smw-skeleton--line" />
        <div className="smw-skeleton smw-skeleton--line smw-skeleton--short" />
      </div>
    </div>
  );
}

export const BrowseList: React.FC<BrowseListProps> = ({
  api,
  types,
  accentColor,
}) => {
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackType | 'all'>('all');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { type?: string; sort?: string } = { sort: 'upvotes' };
      if (filter !== 'all') params.type = filter;
      const result = await api.listFeedback(params);
      setItems(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  }, [api, filter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + '...' : text;

  const allFilters: Array<FeedbackType | 'all'> = ['all', ...types];

  return (
    <div className="smw-browse">
      {/* Filter pills */}
      <div className="smw-browse__filters">
        {allFilters.map((f) => (
          <button
            key={f}
            type="button"
            className={`smw-filter-pill ${filter === f ? 'smw-filter-pill--active' : ''}`}
            style={
              filter === f
                ? ({ '--smw-accent': accentColor } as React.CSSProperties)
                : undefined
            }
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="smw-browse__list">
        {loading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : error ? (
          <div className="smw-browse__empty">
            <p>{error}</p>
            <button
              type="button"
              className="smw-btn smw-btn--secondary"
              onClick={fetchFeedback}
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="smw-browse__empty">
            <p>No feedback yet. Be the first to share!</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="smw-browse-item">
              <div
                className="smw-browse-item__upvote smw-browse-item__upvote--readonly"
                style={{ '--smw-accent': accentColor } as React.CSSProperties}
                title="Sign in on the dashboard to upvote"
              >
                <UpvoteIcon />
                <span className="smw-browse-item__count">
                  {item.upvote_count}
                </span>
              </div>
              <div className="smw-browse-item__content">
                <span className={`smw-badge smw-badge--${item.type}`}>
                  {TYPE_LABELS[item.type]}
                </span>
                <h4 className="smw-browse-item__title">{item.title}</h4>
                <p className="smw-browse-item__desc">
                  {truncate(item.description, 120)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
