import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { SurveyWidgetProps, FormQuestionType } from '@saas-maker/shared-types';
import { createApiClient } from './api';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface FormQuestion {
  id: string;
  type: FormQuestionType;
  label: string;
  description: string | null;
  required: boolean;
  options: Record<string, unknown>;
  order_index: number;
}

interface Form {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
  questions: FormQuestion[];
}

type Direction = 'forward' | 'backward';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChoices(q: FormQuestion): string[] {
  if (Array.isArray(q.options?.choices)) return q.options.choices as string[];
  return [];
}

function getMaxRating(q: FormQuestion): number {
  return (q.options?.max as number) || 5;
}

const LETTER_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function validate(q: FormQuestion, value: string): string | null {
  if (q.required && !value.trim()) return 'This field is required';
  if (!value.trim()) return null;
  switch (q.type) {
    case 'email': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
      break;
    }
    case 'url': {
      try { new URL(value); } catch { return 'Please enter a valid URL'; }
      break;
    }
    case 'number': {
      if (isNaN(Number(value))) return 'Please enter a valid number';
      break;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function accentBg(accent: string, opacity: number): string {
  const rgb = hexToRgb(accent);
  if (!rgb) return accent;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

// ---------------------------------------------------------------------------
// Theme styles
// ---------------------------------------------------------------------------

function getThemeColors(theme: 'light' | 'dark' | 'auto'): {
  bg: string;
  text: string;
  textSecondary: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  cardBg: string;
} {
  if (theme === 'dark') {
    return {
      bg: '#0f0f0f',
      text: '#f5f5f5',
      textSecondary: '#a0a0a0',
      border: '#333',
      inputBg: 'transparent',
      inputBorder: '#555',
      cardBg: '#1a1a1a',
    };
  }
  // light and auto default to light
  return {
    bg: '#ffffff',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    inputBg: 'transparent',
    inputBorder: '#d1d5db',
    cardBg: '#ffffff',
  };
}

// ---------------------------------------------------------------------------
// Question input components (inline styles only)
// ---------------------------------------------------------------------------

function ShortTextInput({
  value, onChange, accent, colors,
}: {
  value: string; onChange: (v: string) => void; accent: string;
  colors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer here..."
      autoFocus
      style={{
        width: '100%', border: 'none',
        borderBottom: `2px solid ${value ? accent : colors.inputBorder}`,
        background: colors.inputBg, padding: '8px 0', fontSize: '18px',
        outline: 'none', color: colors.text,
      }}
    />
  );
}

function LongTextInput({
  value, onChange, onAdvance, colors,
}: {
  value: string; onChange: (v: string) => void; onAdvance: () => void;
  colors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAdvance(); } }}
        placeholder="Type your answer here..."
        autoFocus
        rows={4}
        style={{
          width: '100%', resize: 'none', border: 'none',
          borderBottom: `2px solid ${colors.inputBorder}`,
          background: colors.inputBg, padding: '8px 0', fontSize: '18px',
          outline: 'none', color: colors.text, fontFamily: 'inherit',
        }}
      />
      <p style={{ marginTop: '4px', fontSize: '12px', color: colors.textSecondary }}>
        Shift + Enter for new line
      </p>
    </div>
  );
}

function MultipleChoiceInput({
  question, value, onChange, accent, colors,
}: {
  question: FormQuestion; value: string; onChange: (v: string) => void;
  accent: string; colors: ReturnType<typeof getThemeColors>;
}) {
  const choices = getChoices(question);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {choices.map((choice, i) => {
        const selected = value === choice;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(choice)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              borderRadius: '8px', border: `2px solid ${selected ? accent : colors.border}`,
              padding: '12px 16px', textAlign: 'left' as const, cursor: 'pointer',
              background: selected ? accentBg(accent, 0.06) : 'transparent',
              color: colors.text, fontSize: '16px', fontFamily: 'inherit',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <span style={{
              display: 'flex', height: '28px', width: '28px', flexShrink: 0,
              alignItems: 'center', justifyContent: 'center', borderRadius: '4px',
              fontSize: '12px', fontWeight: 700,
              background: selected ? accent : colors.border,
              color: selected ? '#fff' : colors.text,
            }}>
              {LETTER_KEYS[i]}
            </span>
            <span>{choice}</span>
          </button>
        );
      })}
    </div>
  );
}

function CheckboxesInput({
  question, value, onChange, accent, colors,
}: {
  question: FormQuestion; value: string; onChange: (v: string) => void;
  accent: string; colors: ReturnType<typeof getThemeColors>;
}) {
  const choices = getChoices(question);
  const selected = value ? value.split(',').map((s) => s.trim()) : [];

  function toggle(choice: string) {
    const next = selected.includes(choice)
      ? selected.filter((s) => s !== choice)
      : [...selected, choice];
    onChange(next.join(', '));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {choices.map((choice, i) => {
        const isSelected = selected.includes(choice);
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(choice)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              borderRadius: '8px', border: `2px solid ${isSelected ? accent : colors.border}`,
              padding: '12px 16px', textAlign: 'left' as const, cursor: 'pointer',
              background: isSelected ? accentBg(accent, 0.06) : 'transparent',
              color: colors.text, fontSize: '16px', fontFamily: 'inherit',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <span style={{
              display: 'flex', height: '28px', width: '28px', flexShrink: 0,
              alignItems: 'center', justifyContent: 'center', borderRadius: '4px',
              fontSize: '12px', fontWeight: 700,
              background: isSelected ? accent : colors.border,
              color: isSelected ? '#fff' : colors.text,
            }}>
              {isSelected ? '\u2713' : LETTER_KEYS[i]}
            </span>
            <span>{choice}</span>
          </button>
        );
      })}
    </div>
  );
}

function DropdownInput({
  question, value, onChange, accent, colors,
}: {
  question: FormQuestion; value: string; onChange: (v: string) => void;
  accent: string; colors: ReturnType<typeof getThemeColors>;
}) {
  const choices = getChoices(question);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', borderRadius: '8px',
        border: `2px solid ${value ? accent : colors.inputBorder}`,
        background: colors.inputBg, padding: '12px 16px', fontSize: '18px',
        outline: 'none', color: colors.text, fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      <option value="">Select an option...</option>
      {choices.map((choice, i) => (
        <option key={i} value={choice}>{choice}</option>
      ))}
    </select>
  );
}

function RatingInput({
  question, value, onChange, accent,
}: {
  question: FormQuestion; value: string; onChange: (v: string) => void;
  accent: string;
}) {
  const max = getMaxRating(question);
  const numValue = parseInt(value) || 0;
  const [hovered, setHovered] = useState(0);

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
        const filled = star <= (hovered || numValue);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(String(star))}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              transition: 'transform 0.1s',
              transform: hovered === star ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill={filled ? accent : 'none'}
              stroke={filled ? accent : '#d1d5db'} strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function NpsInput({
  value, onChange, accent, colors,
}: {
  value: string; onChange: (v: string) => void;
  accent: string; colors: ReturnType<typeof getThemeColors>;
}) {
  const numValue = value !== '' ? parseInt(value) : -1;

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const selected = numValue === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              style={{
                display: 'flex', height: '44px', width: '44px',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px', border: `2px solid ${selected ? accent : colors.border}`,
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                background: selected ? accent : 'transparent',
                color: selected ? '#fff' : colors.text,
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.textSecondary }}>
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
    </div>
  );
}

function YesNoInput({
  value, onChange, accent, colors,
}: {
  value: string; onChange: (v: string) => void;
  accent: string; colors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      {['Yes', 'No'].map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              flex: 1, borderRadius: '8px',
              border: `2px solid ${selected ? accent : colors.border}`,
              padding: '16px 24px', fontSize: '18px', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              background: selected ? accentBg(accent, 0.06) : 'transparent',
              color: selected ? accent : colors.text,
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function GenericTextInput({
  type, value, onChange, accent, colors, placeholder,
}: {
  type: string; value: string; onChange: (v: string) => void;
  accent: string; colors: ReturnType<typeof getThemeColors>; placeholder: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus
      style={{
        width: '100%', border: 'none',
        borderBottom: `2px solid ${value ? accent : colors.inputBorder}`,
        background: colors.inputBg, padding: '8px 0', fontSize: '18px',
        outline: 'none', color: colors.text, fontFamily: 'inherit',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Question input dispatcher
// ---------------------------------------------------------------------------

function QuestionInput({
  question, value, onChange, onAdvance, accent, colors,
}: {
  question: FormQuestion; value: string; onChange: (v: string) => void;
  onAdvance: () => void; accent: string; colors: ReturnType<typeof getThemeColors>;
}) {
  const autoAdvance = useCallback((v: string) => {
    onChange(v);
    setTimeout(() => onAdvance(), 200);
  }, [onChange, onAdvance]);

  switch (question.type) {
    case 'short_text':
      return <ShortTextInput value={value} onChange={onChange} accent={accent} colors={colors} />;
    case 'long_text':
      return <LongTextInput value={value} onChange={onChange} onAdvance={onAdvance} colors={colors} />;
    case 'multiple_choice':
      return <MultipleChoiceInput question={question} value={value} onChange={autoAdvance} accent={accent} colors={colors} />;
    case 'checkboxes':
      return <CheckboxesInput question={question} value={value} onChange={onChange} accent={accent} colors={colors} />;
    case 'dropdown':
      return <DropdownInput question={question} value={value} onChange={autoAdvance} accent={accent} colors={colors} />;
    case 'yes_no':
      return <YesNoInput value={value} onChange={autoAdvance} accent={accent} colors={colors} />;
    case 'rating':
      return <RatingInput question={question} value={value} onChange={autoAdvance} accent={accent} />;
    case 'nps':
      return <NpsInput value={value} onChange={autoAdvance} accent={accent} colors={colors} />;
    case 'email':
      return <GenericTextInput type="email" value={value} onChange={onChange} accent={accent} colors={colors} placeholder="name@example.com" />;
    case 'number':
      return <GenericTextInput type="number" value={value} onChange={onChange} accent={accent} colors={colors} placeholder="Type a number..." />;
    case 'date':
      return <GenericTextInput type="date" value={value} onChange={onChange} accent={accent} colors={colors} placeholder="" />;
    case 'phone':
      return <GenericTextInput type="tel" value={value} onChange={onChange} accent={accent} colors={colors} placeholder="+1 (555) 000-0000" />;
    case 'url':
      return <GenericTextInput type="url" value={value} onChange={onChange} accent={accent} colors={colors} placeholder="https://" />;
    default:
      return <ShortTextInput value={value} onChange={onChange} accent={accent} colors={colors} />;
  }
}

// ---------------------------------------------------------------------------
// Main SurveyWidget
// ---------------------------------------------------------------------------

const DEFAULT_ACCENT = '#2563eb';

export const SurveyWidget: React.FC<SurveyWidgetProps> = ({
  projectId,
  formSlug,
  theme = 'auto',
  accentColor,
  onComplete,
}) => {
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(-1); // -1 = welcome
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [direction, setDirection] = useState<Direction>('forward');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [animating, setAnimating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const api = useMemo(() => createApiClient(projectId), [projectId]);
  const resolvedTheme = theme === 'auto' ? 'light' : theme;
  const colors = getThemeColors(resolvedTheme);
  const accent = accentColor || (form?.theme?.accentColor as string) || DEFAULT_ACCENT;

  const questions = useMemo(
    () => (form?.questions ?? []).sort((a, b) => a.order_index - b.order_index),
    [form],
  );

  const totalQuestions = questions.length;
  const isWelcome = currentIndex === -1;
  const isThankYou = currentIndex === totalQuestions;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const currentQuestion = !isWelcome && !isThankYou ? questions[currentIndex] : null;
  const progress = isWelcome ? 0 : isThankYou ? 100 : ((currentIndex + 1) / totalQuestions) * 100;

  // Fetch form on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getForm(formSlug);
        if (!cancelled) setForm(data);
      } catch {
        if (!cancelled) setFetchError('Unable to load survey. Please try again later.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, formSlug]);

  const setAnswer = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, value);
      return next;
    });
    setError(null);
  }, []);

  const transition = useCallback((nextIndex: number, dir: Direction) => {
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setError(null);
      requestAnimationFrame(() => setAnimating(false));
    }, 200);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || !form) return;
    setSubmitting(true);
    setError(null);

    for (const q of questions) {
      const val = answers.get(q.id) || '';
      const err = validate(q, val);
      if (err) {
        setError(`${q.label}: ${err}`);
        setSubmitting(false);
        return;
      }
    }

    const payload = questions
      .map((q) => ({ question_id: q.id, value: answers.get(q.id) || '' }))
      .filter((a) => a.value.trim() !== '');

    try {
      const result = await api.submitResponse(form.id, payload);
      setSubmitted(true);
      transition(totalQuestions, 'forward');
      onComplete?.(result);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, form, questions, answers, api, totalQuestions, transition, onComplete]);

  const goNext = useCallback(() => {
    if (animating || submitting) return;
    if (currentQuestion) {
      const val = answers.get(currentQuestion.id) || '';
      const err = validate(currentQuestion, val);
      if (err) { setError(err); return; }
    }
    if (isLastQuestion) {
      handleSubmit();
    } else {
      transition(currentIndex + 1, 'forward');
    }
  }, [currentIndex, currentQuestion, answers, animating, submitting, isLastQuestion, handleSubmit, transition]);

  const goBack = useCallback(() => {
    if (animating || currentIndex <= -1) return;
    transition(currentIndex - 1, 'backward');
  }, [currentIndex, animating, transition]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.key === 'Enter' && !e.shiftKey) {
        if (!isTextInput || tag === 'INPUT') {
          e.preventDefault();
          goNext();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext]);

  // ---------------------------------------------------------------------------
  // Slide animation
  // ---------------------------------------------------------------------------

  const slideStyle: React.CSSProperties = animating
    ? {
        transform: direction === 'forward' ? 'translateY(32px)' : 'translateY(-32px)',
        opacity: 0,
        transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
      }
    : {
        transform: 'translateY(0)',
        opacity: 1,
        transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
      };

  // ---------------------------------------------------------------------------
  // Loading / Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '300px', fontFamily: 'system-ui, -apple-system, sans-serif',
        color: colors.textSecondary, background: colors.bg,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px', height: '32px', border: `3px solid ${colors.border}`,
            borderTopColor: accent, borderRadius: '50%',
            animation: 'smw-spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <style>{`@keyframes smw-spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ fontSize: '14px' }}>Loading survey...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !form) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '300px', fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#ef4444', background: colors.bg, padding: '24px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '16px', fontWeight: 500 }}>{fetchError || 'Survey not found'}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '12px', padding: '8px 16px', borderRadius: '6px',
              border: '1px solid #ef4444', background: 'transparent',
              color: '#ef4444', cursor: 'pointer', fontSize: '14px',
              fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        minHeight: '400px', background: colors.bg, color: colors.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Progress bar */}
      {!isWelcome && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: colors.border, zIndex: 10 }}>
          <div style={{
            height: '100%', background: accent,
            width: `${progress}%`,
            transition: 'width 0.5s ease-out',
          }} />
        </div>
      )}

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: '640px', ...slideStyle }}>

          {/* Welcome screen */}
          {isWelcome && (
            <div style={{ textAlign: 'center' }}>
              <h1 style={{
                fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em',
                color: colors.text, margin: 0, lineHeight: 1.2,
              }}>
                {form.title}
              </h1>
              {form.description && (
                <p style={{ marginTop: '16px', fontSize: '18px', color: colors.textSecondary, lineHeight: 1.5 }}>
                  {form.description}
                </p>
              )}
              <button
                onClick={() => transition(0, 'forward')}
                style={{
                  marginTop: '32px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                  borderRadius: '8px', padding: '12px 32px', fontSize: '18px',
                  fontWeight: 500, color: '#fff', background: accent,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Start
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Question screen */}
          {currentQuestion && !isThankYou && (
            <div>
              <p style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: accent }}>
                {currentIndex + 1} <span style={{ color: colors.textSecondary }}>{'->'}</span>
              </p>

              <h2 style={{ fontSize: '24px', fontWeight: 600, color: colors.text, margin: 0, lineHeight: 1.3 }}>
                {currentQuestion.label}
                {currentQuestion.required && (
                  <span style={{ marginLeft: '4px', color: '#ef4444' }}>*</span>
                )}
              </h2>

              {currentQuestion.description && (
                <p style={{ marginTop: '8px', fontSize: '16px', color: colors.textSecondary, lineHeight: 1.5 }}>
                  {currentQuestion.description}
                </p>
              )}

              <div style={{ marginTop: '24px' }}>
                <QuestionInput
                  question={currentQuestion}
                  value={answers.get(currentQuestion.id) || ''}
                  onChange={(v) => setAnswer(currentQuestion.id, v)}
                  onAdvance={goNext}
                  accent={accent}
                  colors={colors}
                />
              </div>

              {error && (
                <p style={{ marginTop: '12px', fontSize: '14px', color: '#ef4444' }}>{error}</p>
              )}

              <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={isLastQuestion ? handleSubmit : goNext}
                  disabled={submitting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    borderRadius: '8px', padding: '10px 24px', fontSize: '14px',
                    fontWeight: 500, color: '#fff', background: accent,
                    border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.5 : 1, fontFamily: 'inherit',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {submitting ? 'Submitting...' : isLastQuestion ? 'Submit' : 'OK'}
                  {!submitting && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 12 7 17 22 2" />
                    </svg>
                  )}
                </button>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>
                  Press <strong>Enter</strong> {'<-\''}
                </span>
              </div>
            </div>
          )}

          {/* Thank you screen */}
          {isThankYou && submitted && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: accentBg(accent, 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 12 7 17 22 2" />
                </svg>
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0 }}>
                Thank you!
              </h2>
              <p style={{ marginTop: '12px', fontSize: '18px', color: colors.textSecondary, lineHeight: 1.5 }}>
                {(form.settings?.thankYouMessage as string) || 'Your response has been recorded.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      {!isWelcome && !isThankYou && (
        <div style={{
          position: 'absolute', bottom: '24px', right: '24px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <button
            onClick={goBack}
            disabled={currentIndex <= 0}
            aria-label="Previous question"
            style={{
              display: 'flex', height: '40px', width: '40px',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', border: `1px solid ${colors.border}`,
              background: colors.cardBg, color: colors.textSecondary,
              cursor: currentIndex <= 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex <= 0 ? 0.3 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button
            onClick={goNext}
            aria-label="Next question"
            style={{
              display: 'flex', height: '40px', width: '40px',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', border: `1px solid ${colors.border}`,
              background: colors.cardBg, color: colors.textSecondary,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
