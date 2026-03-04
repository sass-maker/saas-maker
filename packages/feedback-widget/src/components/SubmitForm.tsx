import React, { useState, useCallback } from 'react';
import type { FeedbackType, SubmitFeedbackRequest } from '../types';
import type { ApiClient } from '../api';
import { ImageUpload } from './ImageUpload';

interface SubmitFormProps {
  api: ApiClient;
  userEmail?: string;
  userName?: string;
  types: FeedbackType[];
  accentColor: string;
}

const TYPE_CONFIG: Record<FeedbackType, { label: string; emoji: string }> = {
  bug: { label: 'Bug', emoji: '\u{1F41B}' },
  feature: { label: 'Feature', emoji: '\u{2728}' },
  feedback: { label: 'Feedback', emoji: '\u{1F4AC}' },
};

const CheckIcon: React.FC = () => (
  <svg
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const SubmitForm: React.FC<SubmitFormProps> = ({
  api,
  userEmail,
  userName,
  types,
  accentColor,
}) => {
  const [selectedType, setSelectedType] = useState<FeedbackType>(types[0] || 'feedback');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [email, setEmail] = useState(userEmail || '');
  const [name, setName] = useState(userName || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedType(types[0] || 'feedback');
    setTitle('');
    setDescription('');
    setImageUrl(null);
    if (!userEmail) setEmail('');
    if (!userName) setName('');
    setError(null);
  }, [types, userEmail, userName]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const resolvedEmail = userEmail || email;
      if (!resolvedEmail.trim()) {
        setError('Email is required.');
        return;
      }
      if (!title.trim()) {
        setError('Title is required.');
        return;
      }
      if (!description.trim()) {
        setError('Description is required.');
        return;
      }

      setSubmitting(true);
      try {
        const payload: SubmitFeedbackRequest = {
          type: selectedType,
          title: title.trim(),
          description: description.trim(),
          submitter_email: resolvedEmail.trim(),
        };
        if (imageUrl) payload.image_url = imageUrl;
        const resolvedName = userName || name;
        if (resolvedName.trim()) payload.submitter_name = resolvedName.trim();

        await api.submitFeedback(payload);
        setSubmitted(true);
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setSubmitting(false);
      }
    },
    [api, selectedType, title, description, imageUrl, email, name, userEmail, userName, resetForm],
  );

  if (submitted) {
    return (
      <div className="smw-submit-success">
        <div className="smw-submit-success__icon" style={{ color: accentColor }}>
          <CheckIcon />
        </div>
        <h3 className="smw-submit-success__title">Thank you!</h3>
        <p className="smw-submit-success__message">
          Your feedback has been submitted successfully.
        </p>
        <button
          type="button"
          className="smw-btn smw-btn--primary"
          style={{ '--smw-accent': accentColor } as React.CSSProperties}
          onClick={() => setSubmitted(false)}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form className="smw-submit-form" onSubmit={handleSubmit}>
      {/* Type selector */}
      <div className="smw-field">
        <label className="smw-label">Type</label>
        <div className="smw-type-selector">
          {types.map((type) => (
            <button
              key={type}
              type="button"
              className={`smw-type-btn smw-type-btn--${type} ${selectedType === type ? 'smw-type-btn--active' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              <span className="smw-type-btn__emoji">{TYPE_CONFIG[type].emoji}</span>
              {TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="smw-field">
        <label className="smw-label" htmlFor="smw-title">
          Title <span className="smw-required">*</span>
        </label>
        <input
          id="smw-title"
          type="text"
          className="smw-input"
          placeholder="Brief summary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
      </div>

      {/* Description */}
      <div className="smw-field">
        <label className="smw-label" htmlFor="smw-description">
          Description <span className="smw-required">*</span>
        </label>
        <textarea
          id="smw-description"
          className="smw-textarea"
          placeholder="Provide more details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={5000}
          required
        />
      </div>

      {/* Image upload */}
      <div className="smw-field">
        <label className="smw-label">Screenshot (optional)</label>
        <ImageUpload api={api} imageUrl={imageUrl} onImageUrl={setImageUrl} />
      </div>

      {/* Email */}
      <div className="smw-field">
        <label className="smw-label" htmlFor="smw-email">
          Email <span className="smw-required">*</span>
        </label>
        {userEmail ? (
          <input
            id="smw-email"
            type="email"
            className="smw-input smw-input--disabled"
            value={userEmail}
            disabled
          />
        ) : (
          <input
            id="smw-email"
            type="email"
            className="smw-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}
      </div>

      {/* Name */}
      <div className="smw-field">
        <label className="smw-label" htmlFor="smw-name">
          Name
        </label>
        {userName ? (
          <input
            id="smw-name"
            type="text"
            className="smw-input smw-input--disabled"
            value={userName}
            disabled
          />
        ) : (
          <input
            id="smw-name"
            type="text"
            className="smw-input"
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </div>

      {/* Error */}
      {error && <p className="smw-error">{error}</p>}

      {/* Submit */}
      <button
        type="submit"
        className="smw-btn smw-btn--primary smw-btn--full"
        style={{ '--smw-accent': accentColor } as React.CSSProperties}
        disabled={submitting}
      >
        {submitting ? (
          <span className="smw-btn__loading">
            <span className="smw-spinner" />
            Submitting...
          </span>
        ) : (
          'Submit Feedback'
        )}
      </button>
    </form>
  );
};
