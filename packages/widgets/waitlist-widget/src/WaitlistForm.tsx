import React, { useEffect, useMemo, useState } from 'react';
import type { WaitlistFormProps } from '@saas-maker/shared-types';
import { createApiClient } from './api';
import './styles/waitlist.css';

const DEFAULT_ACCENT = '#1464ff';

export const WaitlistForm: React.FC<WaitlistFormProps> = ({
  projectId,
  apiBaseUrl,
  theme = 'auto',
  accentColor = DEFAULT_ACCENT,
  showCount = true,
  onSuccess,
  placeholder = 'you@example.com',
  buttonText = 'Join Waitlist',
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);

  const api = useMemo(
    () => createApiClient(projectId, apiBaseUrl),
    [projectId, apiBaseUrl],
  );

  const themeClass =
    theme === 'light'
      ? 'smw-wl--light'
      : theme === 'dark'
        ? 'smw-wl--dark'
        : 'smw-wl--auto';

  useEffect(() => {
    if (showCount) {
      api.getCount().then(setCount).catch(() => {});
    }
  }, [api, showCount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await api.signup(email.trim(), name.trim() || undefined);
      setPosition(result.position);
      setCount((prev) => (prev !== null ? prev + 1 : null));
      onSuccess?.(result.position);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (position !== null) {
    return (
      <div
        data-saasmaker-waitlist=""
        className={themeClass}
        style={{ '--smw-wl-accent': accentColor } as React.CSSProperties}
      >
        <div className="smw-wl-success">
          <div className="smw-wl-success-icon">&#10003;</div>
          <p className="smw-wl-success-title">You're on the list!</p>
          <p className="smw-wl-success-position">You're #{position} on the waitlist.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-saasmaker-waitlist=""
      className={themeClass}
      style={{ '--smw-wl-accent': accentColor } as React.CSSProperties}
    >
      <form className="smw-wl-form" onSubmit={handleSubmit}>
        <input
          type="email"
          className="smw-wl-input"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={submitting}
        />
        <input
          type="text"
          className="smw-wl-input"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />
        {error && <p className="smw-wl-error">{error}</p>}
        <button type="submit" className="smw-wl-button" disabled={submitting}>
          {submitting ? 'Joining...' : buttonText}
        </button>
      </form>
      {showCount && count !== null && count > 0 && (
        <p className="smw-wl-count">{count.toLocaleString()} already signed up</p>
      )}
    </div>
  );
};
