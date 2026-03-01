import React, { useMemo, useRef, useState } from 'react';
import type { TestimonialFormProps } from '@saas-maker/shared-types';
import { createApiClient } from './api';
import './styles/testimonials.css';

const DEFAULT_ACCENT = '#1464ff';

export const TestimonialForm: React.FC<TestimonialFormProps> = ({
  projectId,
  apiBaseUrl,
  theme = 'auto',
  accentColor = DEFAULT_ACCENT,
  placeholder = 'Share your experience...',
  buttonText = 'Submit Testimonial',
  showImageUpload = true,
  showTweetUrl = false,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [tweetUrl, setTweetUrl] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const api = useMemo(() => createApiClient(projectId, apiBaseUrl), [projectId, apiBaseUrl]);

  const themeClass = theme === 'light' ? 'smw-tm--light' : theme === 'dark' ? 'smw-tm--dark' : 'smw-tm--auto';

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadImage(file);
      setImageUrl(result.url);
      setImageName(file.name);
    } catch {
      setError('Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !content.trim() || rating === 0) {
      setError('Please fill in all required fields and select a rating.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.submit({
        author_name: name.trim(),
        author_email: email.trim(),
        author_title: title.trim() || undefined,
        content: content.trim(),
        rating,
        image_url: imageUrl || undefined,
        tweet_url: tweetUrl.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div data-saasmaker-testimonials="" className={themeClass} style={{ '--smw-tm-accent': accentColor } as React.CSSProperties}>
        <div className="smw-tm-success">
          <div className="smw-tm-success-icon">&#10003;</div>
          <p className="smw-tm-success-title">Thank you!</p>
          <p className="smw-tm-success-sub">Your testimonial has been submitted for review.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-saasmaker-testimonials="" className={themeClass} style={{ '--smw-tm-accent': accentColor } as React.CSSProperties}>
      <form className="smw-tm-form" onSubmit={handleSubmit}>
        <div className="smw-tm-row">
          <input type="text" className="smw-tm-input" placeholder="Your name *" value={name} onChange={(e) => setName(e.target.value)} required disabled={submitting} />
          <input type="email" className="smw-tm-input" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={submitting} />
        </div>
        <input type="text" className="smw-tm-input" placeholder="Title / Company (optional)" value={title} onChange={(e) => setTitle(e.target.value)} disabled={submitting} />

        <div className="smw-tm-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`smw-tm-star ${star <= (hoverRating || rating) ? 'smw-tm-star--active' : ''}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              disabled={submitting}
            >
              &#9733;
            </button>
          ))}
        </div>

        <textarea className="smw-tm-textarea" placeholder={placeholder} value={content} onChange={(e) => setContent(e.target.value)} required disabled={submitting} />

        {showImageUpload && (
          <div className="smw-tm-upload">
            <button type="button" className="smw-tm-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading || submitting}>
              {uploading ? 'Uploading...' : 'Attach image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} />
            {imageName && <span>{imageName}</span>}
          </div>
        )}

        {showTweetUrl && (
          <input type="url" className="smw-tm-input" placeholder="Tweet URL (optional)" value={tweetUrl} onChange={(e) => setTweetUrl(e.target.value)} disabled={submitting} />
        )}

        {error && <p className="smw-tm-error">{error}</p>}

        <button type="submit" className="smw-tm-button" disabled={submitting}>
          {submitting ? 'Submitting...' : buttonText}
        </button>
      </form>
    </div>
  );
};
