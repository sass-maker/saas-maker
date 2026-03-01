import React, { useEffect, useMemo, useState } from 'react';
import type { TestimonialWallProps } from '@saasmaker/shared-types';
import { createApiClient, TestimonialData } from './api';
import './styles/testimonials.css';

const DEFAULT_ACCENT = '#1464ff';

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
);

export const TestimonialWall: React.FC<TestimonialWallProps> = ({
  projectId,
  apiBaseUrl,
  theme = 'auto',
  accentColor = DEFAULT_ACCENT,
  layout = 'grid',
  maxItems,
}) => {
  const [testimonials, setTestimonials] = useState<TestimonialData[]>([]);
  const [loading, setLoading] = useState(true);

  const api = useMemo(() => createApiClient(projectId, apiBaseUrl), [projectId, apiBaseUrl]);
  const themeClass = theme === 'light' ? 'smw-tm--light' : theme === 'dark' ? 'smw-tm--dark' : 'smw-tm--auto';

  useEffect(() => {
    api.list(maxItems).then((data) => {
      setTestimonials(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [api, maxItems]);

  if (loading) return null;

  if (testimonials.length === 0) {
    return (
      <div data-saasmaker-testimonials="" className={themeClass}>
        <div className="smw-tm-empty">No testimonials yet.</div>
      </div>
    );
  }

  const layoutClass = layout === 'masonry' ? 'smw-tm-wall--masonry' : layout === 'list' ? 'smw-tm-wall--list' : 'smw-tm-wall--grid';

  return (
    <div data-saasmaker-testimonials="" className={themeClass} style={{ '--smw-tm-accent': accentColor } as React.CSSProperties}>
      <div className={`smw-tm-wall ${layoutClass}`}>
        {testimonials.map((t) => (
          <div key={t.id} className="smw-tm-card">
            <div className="smw-tm-card-header">
              {t.author_avatar_url ? (
                <img className="smw-tm-avatar" src={t.author_avatar_url} alt={t.author_name} />
              ) : (
                <div className="smw-tm-avatar-placeholder">{t.author_name.charAt(0).toUpperCase()}</div>
              )}
              <div>
                <div className="smw-tm-author-name">{t.author_name}</div>
                {t.author_title && <div className="smw-tm-author-title">{t.author_title}</div>}
              </div>
            </div>

            <div className="smw-tm-card-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`smw-tm-card-star ${star <= t.rating ? '' : 'smw-tm-card-star--empty'}`}>&#9733;</span>
              ))}
            </div>

            <p className="smw-tm-card-content">{t.content}</p>

            {t.image_url && <img className="smw-tm-card-image" src={t.image_url} alt="Testimonial attachment" />}

            {t.tweet_url && (
              <a className="smw-tm-card-tweet" href={t.tweet_url} target="_blank" rel="noopener noreferrer">
                <XIcon /> View on X
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
