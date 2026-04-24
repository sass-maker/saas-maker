"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { FormQuestionType } from "@saas-maker/shared-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

// ---------------------------------------------------------------------------
// Types
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

interface SurveyRendererProps {
  form: Form;
}

type Direction = "forward" | "backward";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAccentColor(form: Form): string {
  return (form.theme?.accentColor as string) || "#2563eb";
}

function getChoices(q: FormQuestion): string[] {
  if (Array.isArray(q.options?.choices)) return q.options.choices as string[];
  return [];
}

function getMaxRating(q: FormQuestion): number {
  return (q.options?.max as number) || 5;
}

function getScaleMin(q: FormQuestion): number {
  return (q.options?.min as number) ?? 1;
}

function getScaleMax(q: FormQuestion): number {
  return (q.options?.max as number) ?? 5;
}

function getScaleMinLabel(q: FormQuestion): string {
  return (q.options?.min_label as string) || "";
}

function getScaleMaxLabel(q: FormQuestion): string {
  return (q.options?.max_label as string) || "";
}

const LETTER_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(q: FormQuestion, value: string): string | null {
  if (q.required && !value.trim()) return "This field is required";
  if (!value.trim()) return null;

  switch (q.type) {
    case "email": {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) return "Please enter a valid email address";
      break;
    }
    case "url": {
      try {
        new URL(value);
      } catch {
        return "Please enter a valid URL";
      }
      break;
    }
    case "number": {
      if (isNaN(Number(value))) return "Please enter a valid number";
      break;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Question Input Components
// ---------------------------------------------------------------------------

function ShortTextInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer here..."
      autoFocus
      className="w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-current"
      style={{ borderBottomColor: value ? accent : undefined }}
    />
  );
}

function LongTextInput({
  value,
  onChange,
  onAdvance,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdvance: () => void;
  accent: string;
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onAdvance();
    }
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your answer here..."
        autoFocus
        rows={4}
        className="w-full resize-none border-0 border-b-2 border-gray-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-blue-500"
      />
      <p className="mt-1 text-xs text-gray-400">
        Shift + Enter for new line
      </p>
    </div>
  );
}

function MultipleChoiceInput({
  question,
  value,
  onChange,
  accent,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const choices = getChoices(question);

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, i) => {
        const selected = value === choice;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(choice)}
            className="flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all hover:border-gray-400"
            style={{
              borderColor: selected ? accent : undefined,
              backgroundColor: selected ? `${accent}10` : undefined,
            }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold"
              style={{
                backgroundColor: selected ? accent : "#e5e7eb",
                color: selected ? "#fff" : "#374151",
              }}
            >
              {LETTER_KEYS[i]}
            </span>
            <span className="text-base">{choice}</span>
          </button>
        );
      })}
    </div>
  );
}

function CheckboxesInput({
  question,
  value,
  onChange,
  accent,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const choices = getChoices(question);
  const selected = value ? value.split(",").map((s) => s.trim()) : [];

  function toggle(choice: string) {
    const next = selected.includes(choice)
      ? selected.filter((s) => s !== choice)
      : [...selected, choice];
    onChange(next.join(", "));
  }

  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, i) => {
        const isSelected = selected.includes(choice);
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(choice)}
            className="flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-all hover:border-gray-400"
            style={{
              borderColor: isSelected ? accent : undefined,
              backgroundColor: isSelected ? `${accent}10` : undefined,
            }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold"
              style={{
                backgroundColor: isSelected ? accent : "#e5e7eb",
                color: isSelected ? "#fff" : "#374151",
              }}
            >
              {isSelected ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2 7 5.5 10.5 12 3.5" />
                </svg>
              ) : (
                LETTER_KEYS[i]
              )}
            </span>
            <span className="text-base">{choice}</span>
          </button>
        );
      })}
    </div>
  );
}

function DropdownInput({
  question,
  value,
  onChange,
  accent,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const choices = getChoices(question);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border-2 border-gray-300 bg-transparent px-4 py-3 text-lg outline-none transition-colors focus:border-blue-500"
      style={{ borderColor: value ? accent : undefined }}
    >
      <option value="">Select an option...</option>
      {choices.map((choice, i) => (
        <option key={i} value={choice}>
          {choice}
        </option>
      ))}
    </select>
  );
}

function YesNoInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div className="flex gap-4">
      {["Yes", "No"].map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="flex-1 rounded-lg border-2 px-6 py-4 text-lg font-medium transition-all hover:border-gray-400"
            style={{
              borderColor: selected ? accent : undefined,
              backgroundColor: selected ? `${accent}10` : undefined,
              color: selected ? accent : undefined,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function RatingInput({
  question,
  value,
  onChange,
  accent,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const max = getMaxRating(question);
  const numValue = parseInt(value) || 0;
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => {
        const filled = star <= (hovered || numValue);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(String(star))}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill={filled ? accent : "none"}
              stroke={filled ? accent : "#d1d5db"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function NpsInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const numValue = value !== "" ? parseInt(value) : -1;

  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => {
          const selected = numValue === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className="flex h-11 w-11 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all hover:border-gray-400"
              style={{
                borderColor: selected ? accent : undefined,
                backgroundColor: selected ? accent : undefined,
                color: selected ? "#fff" : undefined,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-400">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
    </div>
  );
}

function OpinionScaleInput({
  question,
  value,
  onChange,
  accent,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  const min = getScaleMin(question);
  const max = getScaleMax(question);
  const minLabel = getScaleMinLabel(question);
  const maxLabel = getScaleMaxLabel(question);
  const numValue = value !== "" ? parseInt(value) : -1;
  const count = max - min + 1;

  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: count }, (_, i) => min + i).map((n) => {
          const selected = numValue === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className="flex h-11 w-11 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all hover:border-gray-400"
              style={{
                borderColor: selected ? accent : undefined,
                backgroundColor: selected ? accent : undefined,
                color: selected ? "#fff" : undefined,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function EmailInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <input
      type="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="name@example.com"
      autoFocus
      className="w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-current"
      style={{ borderBottomColor: value ? accent : undefined }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type a number..."
      autoFocus
      className="w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-current"
      style={{ borderBottomColor: value ? accent : undefined }}
    />
  );
}

function DateInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
      className="w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-current"
      style={{ borderBottomColor: value ? accent : undefined }}
    />
  );
}

function PhoneInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <input
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="+1 (555) 000-0000"
      autoFocus
      className="w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-current"
      style={{ borderBottomColor: value ? accent : undefined }}
    />
  );
}

function UrlInput({
  value,
  onChange,
  accent,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="https://"
      autoFocus
      className="w-full border-0 border-b-2 border-gray-300 bg-transparent py-2 text-lg outline-none transition-colors focus:border-current"
      style={{ borderBottomColor: value ? accent : undefined }}
    />
  );
}

function FileUploadInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <input
      type="file"
      onChange={(e) => {
        const file = e.target.files?.[0];
        onChange(file ? file.name : "");
      }}
      className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
    />
  );
}

// ---------------------------------------------------------------------------
// Question Input Renderer
// ---------------------------------------------------------------------------

function QuestionInput({
  question,
  value,
  onChange,
  onAdvance,
  accent,
}: {
  question: FormQuestion;
  value: string;
  onChange: (v: string) => void;
  onAdvance: () => void;
  accent: string;
}) {
  // Auto-advance types: after selection, go to next
  const autoAdvanceOnChange = useCallback(
    (v: string) => {
      onChange(v);
      // Defer so state settles before advancing
      setTimeout(() => onAdvance(), 200);
    },
    [onChange, onAdvance]
  );

  switch (question.type) {
    case "short_text":
      return <ShortTextInput value={value} onChange={onChange} accent={accent} />;
    case "long_text":
      return (
        <LongTextInput
          value={value}
          onChange={onChange}
          onAdvance={onAdvance}
          accent={accent}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoiceInput
          question={question}
          value={value}
          onChange={autoAdvanceOnChange}
          accent={accent}
        />
      );
    case "checkboxes":
      return (
        <CheckboxesInput
          question={question}
          value={value}
          onChange={onChange}
          accent={accent}
        />
      );
    case "dropdown":
      return (
        <DropdownInput
          question={question}
          value={value}
          onChange={autoAdvanceOnChange}
          accent={accent}
        />
      );
    case "yes_no":
      return (
        <YesNoInput
          value={value}
          onChange={autoAdvanceOnChange}
          accent={accent}
        />
      );
    case "rating":
      return (
        <RatingInput
          question={question}
          value={value}
          onChange={autoAdvanceOnChange}
          accent={accent}
        />
      );
    case "nps":
      return (
        <NpsInput
          value={value}
          onChange={autoAdvanceOnChange}
          accent={accent}
        />
      );
    case "opinion_scale":
      return (
        <OpinionScaleInput
          question={question}
          value={value}
          onChange={autoAdvanceOnChange}
          accent={accent}
        />
      );
    case "email":
      return <EmailInput value={value} onChange={onChange} accent={accent} />;
    case "number":
      return <NumberInput value={value} onChange={onChange} accent={accent} />;
    case "date":
      return <DateInput value={value} onChange={onChange} accent={accent} />;
    case "phone":
      return <PhoneInput value={value} onChange={onChange} accent={accent} />;
    case "url":
      return <UrlInput value={value} onChange={onChange} accent={accent} />;
    case "file_upload":
      return (
        <FileUploadInput value={value} onChange={onChange} accent={accent} />
      );
    default:
      return <ShortTextInput value={value} onChange={onChange} accent={accent} />;
  }
}

// ---------------------------------------------------------------------------
// Main Survey Renderer
// ---------------------------------------------------------------------------

export function SurveyRenderer({ form }: SurveyRendererProps) {
  const questions = [...form.questions].sort(
    (a, b) => a.order_index - b.order_index
  );

  // -1 = welcome, 0..n-1 = question, n = submitting/thank you
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [direction, setDirection] = useState<Direction>("forward");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [animating, setAnimating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const accent = getAccentColor(form);

  const totalQuestions = questions.length;
  const isWelcome = currentIndex === -1;
  const isThankYou = currentIndex === totalQuestions;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const currentQuestion = !isWelcome && !isThankYou ? questions[currentIndex] : null;

  const progress =
    isWelcome ? 0 : isThankYou ? 100 : ((currentIndex + 1) / totalQuestions) * 100;

  const setAnswer = useCallback(
    (questionId: string, value: string) => {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, value);
        return next;
      });
      setError(null);
    },
    []
  );

  const transition = useCallback(
    (nextIndex: number, dir: Direction) => {
      setDirection(dir);
      setAnimating(true);
      // Let the exit animation play, then swap
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setError(null);
        // Allow the enter animation to start after the index has changed
        requestAnimationFrame(() => {
          setAnimating(false);
        });
      }, 200);
    },
    []
  );

  const goNext = useCallback(() => {
    if (animating || submitting) return;

    // Validate current question
    if (currentQuestion) {
      const value = answers.get(currentQuestion.id) || "";
      const err = validate(currentQuestion, value);
      if (err) {
        setError(err);
        return;
      }
    }

    if (isLastQuestion) {
      // Submit
      handleSubmit();
    } else {
      transition(currentIndex + 1, "forward");
    }
  }, [currentIndex, currentQuestion, answers, animating, submitting, isLastQuestion]);

  const goBack = useCallback(() => {
    if (animating || currentIndex <= -1) return;
    transition(currentIndex - 1, "backward");
  }, [currentIndex, animating]);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // Validate all required
    for (const q of questions) {
      const value = answers.get(q.id) || "";
      const err = validate(q, value);
      if (err) {
        setError(`${q.label}: ${err}`);
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      answers: questions
        .map((q) => ({
          question_id: q.id,
          value: answers.get(q.id) || "",
        }))
        .filter((a) => a.value.trim() !== ""),
    };

    try {
      const res = await fetch(
        `${API_BASE}/v1/forms/public/${form.slug}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to submit. Please try again.");
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      transition(totalQuestions, "forward");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Global keyboard handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is typing in a text field (except Enter)
      const tag = (e.target as HTMLElement)?.tagName;
      const isTextInput =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Enter" && !e.shiftKey) {
        // Enter to advance — for text inputs we handle it here,
        // for non-text screens (welcome) too
        if (!isTextInput || tag === "INPUT") {
          e.preventDefault();
          goNext();
        }
      }

      // Number keys for multiple choice
      if (
        currentQuestion?.type === "multiple_choice" &&
        !isTextInput
      ) {
        const choices = getChoices(currentQuestion);
        const num = parseInt(e.key);
        if (num >= 1 && num <= choices.length) {
          setAnswer(currentQuestion.id, choices[num - 1]);
          setTimeout(() => goNext(), 200);
        }
      }

      // Arrow keys for multiple choice
      if (
        currentQuestion?.type === "multiple_choice" &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const choices = getChoices(currentQuestion);
        const currentValue = answers.get(currentQuestion.id) || "";
        const idx = choices.indexOf(currentValue);
        let nextIdx: number;
        if (e.key === "ArrowDown") {
          nextIdx = idx < choices.length - 1 ? idx + 1 : 0;
        } else {
          nextIdx = idx > 0 ? idx - 1 : choices.length - 1;
        }
        setAnswer(currentQuestion.id, choices[nextIdx]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, currentQuestion, answers, goNext, goBack, setAnswer]);

  // ---------------------------------------------------------------------------
  // Slide animation classes
  // ---------------------------------------------------------------------------

  const getSlideClass = () => {
    if (animating) {
      // Exit: slide out
      return direction === "forward"
        ? "translate-y-8 opacity-0"
        : "-translate-y-8 opacity-0";
    }
    // Enter: visible
    return "translate-y-0 opacity-100";
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative flex min-h-screen flex-col bg-white" ref={containerRef}>
      {/* Progress bar */}
      {!isWelcome && (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-gray-100">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div
          className={`w-full max-w-2xl transition-all duration-300 ease-out ${getSlideClass()}`}
        >
          {/* Welcome Screen */}
          {isWelcome && (
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                {form.title}
              </h1>
              {form.description && (
                <p className="mt-4 text-lg text-gray-500">{form.description}</p>
              )}
              <button
                onClick={() => transition(0, "forward")}
                className="mt-8 inline-flex items-center gap-2 rounded-lg px-8 py-3 text-lg font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Start
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Question Screen */}
          {currentQuestion && !isThankYou && (
            <div>
              {/* Question number */}
              <p className="mb-2 text-sm font-medium" style={{ color: accent }}>
                {currentIndex + 1}{" "}
                <span className="text-gray-400">
                  {"->"}
                </span>
              </p>

              {/* Label */}
              <h2 className="text-2xl font-semibold text-gray-900">
                {currentQuestion.label}
                {currentQuestion.required && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </h2>

              {/* Description */}
              {currentQuestion.description && (
                <p className="mt-2 text-base text-gray-500">
                  {currentQuestion.description}
                </p>
              )}

              {/* Input */}
              <div className="mt-6">
                <QuestionInput
                  question={currentQuestion}
                  value={answers.get(currentQuestion.id) || ""}
                  onChange={(v) => setAnswer(currentQuestion.id, v)}
                  onAdvance={goNext}
                  accent={accent}
                />
              </div>

              {/* Error */}
              {error && (
                <p className="mt-3 text-sm text-red-500">{error}</p>
              )}

              {/* OK / Submit button */}
              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={isLastQuestion ? () => handleSubmit() : goNext}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {submitting
                    ? "Submitting..."
                    : isLastQuestion
                      ? "Submit"
                      : "OK"}
                  {!submitting && (
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
                      <polyline points="2 12 7 17 22 2" />
                    </svg>
                  )}
                </button>
                <span className="text-xs text-gray-400">
                  Press <strong>Enter</strong> {"<-'"}
                </span>
              </div>
            </div>
          )}

          {/* Thank You Screen */}
          {isThankYou && submitted && (
            <div className="text-center">
              <div
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: `${accent}15` }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2 12 7 17 22 2" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Thank you!</h2>
              <p className="mt-3 text-lg text-gray-500">
                {(form.settings?.thankYouMessage as string) ||
                  "Your response has been recorded."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      {!isWelcome && !isThankYou && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={currentIndex <= 0}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-30"
            aria-label="Previous question"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
            aria-label="Next question"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
