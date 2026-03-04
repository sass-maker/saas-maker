"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Type,
  AlignLeft,
  CircleDot,
  CheckSquare,
  ChevronDown,
  ToggleLeft,
  Star,
  Gauge,
  SlidersHorizontal,
  Mail,
  Hash,
  Calendar,
  Phone,
  Link as LinkIcon,
  Upload,
  GripVertical,
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  X,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import type {
  FormRecord,
  FormQuestionRecord,
  FormQuestionType,
} from "@saas-maker/shared-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUESTION_TYPES: {
  type: FormQuestionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "short_text", label: "Short Text", icon: Type },
  { type: "long_text", label: "Long Text", icon: AlignLeft },
  { type: "multiple_choice", label: "Multiple Choice", icon: CircleDot },
  { type: "checkboxes", label: "Checkboxes", icon: CheckSquare },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "yes_no", label: "Yes / No", icon: ToggleLeft },
  { type: "rating", label: "Rating", icon: Star },
  { type: "nps", label: "NPS", icon: Gauge },
  { type: "opinion_scale", label: "Opinion Scale", icon: SlidersHorizontal },
  { type: "email", label: "Email", icon: Mail },
  { type: "number", label: "Number", icon: Hash },
  { type: "date", label: "Date", icon: Calendar },
  { type: "phone", label: "Phone", icon: Phone },
  { type: "url", label: "URL", icon: LinkIcon },
  { type: "file_upload", label: "File Upload", icon: Upload },
];

const QUESTION_TYPE_MAP = Object.fromEntries(
  QUESTION_TYPES.map((qt) => [qt.type, qt])
) as Record<FormQuestionType, (typeof QUESTION_TYPES)[number]>;

const CHOICE_TYPES: FormQuestionType[] = [
  "multiple_choice",
  "checkboxes",
  "dropdown",
];

const STATUS_COLORS: Record<
  FormRecord["status"],
  "default" | "secondary" | "outline"
> = {
  draft: "secondary",
  published: "default",
  closed: "outline",
};

// ---------------------------------------------------------------------------
// Local question type (extends the DB record shape for local editing)
// ---------------------------------------------------------------------------

interface LocalQuestion {
  id: string;
  form_id: string;
  type: FormQuestionType;
  label: string;
  description: string | null;
  required: boolean;
  options: Record<string, unknown>;
  order_index: number;
  created_at: string;
  _isNew?: boolean; // marks newly-added questions
}

// ---------------------------------------------------------------------------
// Sortable Question Item
// ---------------------------------------------------------------------------

function SortableQuestionItem({
  question,
  isSelected,
  onSelect,
}: {
  question: LocalQuestion;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = QUESTION_TYPE_MAP[question.type];
  const Icon = meta?.icon ?? Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
        isDragging ? "opacity-50" : ""
      } ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-accent/50"
      }`}
      onClick={onSelect}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate flex-1">
        {question.label || "Untitled question"}
      </span>
      {question.required && (
        <span className="text-destructive text-xs font-bold">*</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type Picker
// ---------------------------------------------------------------------------

function TypePicker({
  onSelect,
  onClose,
}: {
  onSelect: (type: FormQuestionType) => void;
  onClose: () => void;
}) {
  return (
    <Card className="absolute bottom-full left-0 right-0 mb-2 z-10 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Choose question type</CardTitle>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-1.5">
          {QUESTION_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className="flex flex-col items-center gap-1 rounded-md border border-transparent p-2 text-xs hover:bg-accent hover:border-border transition-colors"
            >
              <Icon className="size-4 text-muted-foreground" />
              <span className="text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Options Editor (for choice-based questions)
// ---------------------------------------------------------------------------

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Options</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`Option ${i + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            disabled={options.length <= 1}
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...options, ""])}
      >
        <Plus className="size-3" />
        Add option
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question Editor (center panel)
// ---------------------------------------------------------------------------

function QuestionEditor({
  question,
  onChange,
  onDelete,
}: {
  question: LocalQuestion;
  onChange: (updated: LocalQuestion) => void;
  onDelete: () => void;
}) {
  const choiceOptions = useMemo(() => {
    const raw = question.options?.choices;
    return Array.isArray(raw) ? (raw as string[]) : [""];
  }, [question.options?.choices]);

  return (
    <div className="space-y-5">
      {/* Type selector */}
      <div className="space-y-1.5">
        <Label>Question Type</Label>
        <Select
          value={question.type}
          onValueChange={(val) =>
            onChange({
              ...question,
              type: val as FormQuestionType,
              options:
                CHOICE_TYPES.includes(val as FormQuestionType) &&
                !CHOICE_TYPES.includes(question.type)
                  ? { choices: ["Option 1"] }
                  : question.options,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map(({ type, label, icon: Icon }) => (
              <SelectItem key={type} value={type}>
                <Icon className="size-4" />
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label>Label</Label>
        <Input
          value={question.label}
          onChange={(e) => onChange({ ...question, label: e.target.value })}
          placeholder="Enter your question..."
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Description (optional)</Label>
        <Textarea
          value={question.description ?? ""}
          onChange={(e) =>
            onChange({
              ...question,
              description: e.target.value || null,
            })
          }
          placeholder="Add a description or helper text..."
          rows={2}
        />
      </div>

      {/* Required toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="required-toggle">Required</Label>
        <Switch
          id="required-toggle"
          checked={question.required}
          onCheckedChange={(checked) =>
            onChange({ ...question, required: !!checked })
          }
        />
      </div>

      {/* Choice options */}
      {CHOICE_TYPES.includes(question.type) && (
        <OptionsEditor
          options={choiceOptions}
          onChange={(choices) =>
            onChange({ ...question, options: { ...question.options, choices } })
          }
        />
      )}

      {/* Rating config */}
      {question.type === "rating" && (
        <div className="space-y-1.5">
          <Label>Max stars</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={(question.options?.maxStars as number) ?? 5}
            onChange={(e) =>
              onChange({
                ...question,
                options: {
                  ...question.options,
                  maxStars: parseInt(e.target.value, 10) || 5,
                },
              })
            }
          />
        </div>
      )}

      {/* Opinion scale config */}
      {question.type === "opinion_scale" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min value</Label>
              <Input
                type="number"
                value={(question.options?.min as number) ?? 1}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: {
                      ...question.options,
                      min: parseInt(e.target.value, 10) || 1,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max value</Label>
              <Input
                type="number"
                value={(question.options?.max as number) ?? 10}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: {
                      ...question.options,
                      max: parseInt(e.target.value, 10) || 10,
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min label</Label>
              <Input
                value={(question.options?.minLabel as string) ?? ""}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: {
                      ...question.options,
                      minLabel: e.target.value,
                    },
                  })
                }
                placeholder="e.g. Not at all"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max label</Label>
              <Input
                value={(question.options?.maxLabel as string) ?? ""}
                onChange={(e) =>
                  onChange({
                    ...question,
                    options: {
                      ...question.options,
                      maxLabel: e.target.value,
                    },
                  })
                }
                placeholder="e.g. Very much"
              />
            </div>
          </div>
        </div>
      )}

      {/* NPS notice */}
      {question.type === "nps" && (
        <p className="text-xs text-muted-foreground">
          NPS uses a fixed 0-10 scale. No additional configuration needed.
        </p>
      )}

      {/* Delete */}
      <div className="pt-4 border-t">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="size-3" />
          Delete question
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FormBuilder component
// ---------------------------------------------------------------------------

interface FormBuilderProps {
  form: FormRecord;
  initialQuestions: FormQuestionRecord[];
  projectId: string;
  projectSlug: string;
}

export function FormBuilder({
  form,
  initialQuestions,
  projectId,
  projectSlug,
}: FormBuilderProps) {
  // -- State ----------------------------------------------------------------
  const [questions, setQuestions] = useState<LocalQuestion[]>(
    () =>
      [...initialQuestions]
        .sort((a, b) => a.order_index - b.order_index)
        .map((q) => ({ ...q })) as LocalQuestion[]
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    questions[0]?.id ?? null
  );
  const [title, setTitle] = useState(form.title);
  const [status, setStatus] = useState<FormRecord["status"]>(form.status);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedQuestionId) ?? null,
    [questions, selectedQuestionId]
  );

  // -- DnD sensors ---------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // -- Handlers -------------------------------------------------------------
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setQuestions((prev) => {
        const oldIndex = prev.findIndex((q) => q.id === active.id);
        const newIndex = prev.findIndex((q) => q.id === over.id);
        const reordered = arrayMove(prev, oldIndex, newIndex);
        return reordered.map((q, i) => ({ ...q, order_index: i }));
      });
    },
    []
  );

  const addQuestion = useCallback(
    (type: FormQuestionType) => {
      const id = crypto.randomUUID();
      const newQ: LocalQuestion = {
        id,
        form_id: form.id,
        type,
        label: "",
        description: null,
        required: false,
        options: CHOICE_TYPES.includes(type) ? { choices: ["Option 1"] } : {},
        order_index: questions.length,
        created_at: new Date().toISOString(),
        _isNew: true,
      };
      setQuestions((prev) => [...prev, newQ]);
      setSelectedQuestionId(id);
      setShowTypePicker(false);
    },
    [form.id, questions.length]
  );

  const updateQuestion = useCallback((updated: LocalQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q))
    );
  }, []);

  const deleteQuestion = useCallback(
    (id: string) => {
      const q = questions.find((q) => q.id === id);
      if (q && !q._isNew) {
        setDeletedIds((prev) => [...prev, id]);
      }
      setQuestions((prev) => {
        const filtered = prev.filter((q) => q.id !== id);
        return filtered.map((q, i) => ({ ...q, order_index: i }));
      });
      setSelectedQuestionId((prev) => {
        if (prev !== id) return prev;
        const remaining = questions.filter((q) => q.id !== id);
        return remaining[0]?.id ?? null;
      });
    },
    [questions]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const token = await getClientToken();

      // Delete removed questions
      await Promise.all(
        deletedIds.map((qId) =>
          apiFetchClient(
            `/v1/forms/dashboard/${projectId}/${form.id}/questions/${qId}`,
            token,
            { method: "DELETE" }
          ).catch(() => {
            // ignore delete errors for questions that may already be gone
          })
        )
      );

      // Upsert questions
      const questionsPayload = questions.map((q) => ({
        id: q.id,
        type: q.type,
        label: q.label,
        description: q.description ?? undefined,
        required: q.required,
        options: q.options,
        order_index: q.order_index,
      }));

      await apiFetchClient(
        `/v1/forms/dashboard/${projectId}/${form.id}/questions`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ questions: questionsPayload }),
        }
      );

      // Update form metadata
      await apiFetchClient(
        `/v1/forms/dashboard/${projectId}/${form.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ title, status }),
        }
      );

      // Clear deleted tracking & _isNew flags
      setDeletedIds([]);
      setQuestions((prev) =>
        prev.map((q) => {
          const { _isNew, ...rest } = q;
          return rest as LocalQuestion;
        })
      );
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [questions, deletedIds, title, status, projectId, form.id]);

  const shareUrl =
    status === "published"
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/f/${form.slug}`
      : null;

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  // -- Render ---------------------------------------------------------------
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b px-4 py-3 bg-background shrink-0 flex-wrap">
        <Link href={`/projects/${projectSlug}/forms`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-xs font-semibold border-transparent hover:border-input focus:border-input"
          placeholder="Form title"
        />

        <Select
          value={status}
          onValueChange={(val) =>
            setStatus(val as FormRecord["status"])
          }
        >
          <SelectTrigger className="w-auto">
            <Badge variant={STATUS_COLORS[status]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        {shareUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs"
          >
            {copied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
        )}

        <div className="flex-1" />

        <Link href={`/projects/${projectSlug}/forms/${form.id}/responses`}>
          <Button variant="outline" size="sm">
            <ExternalLink className="size-3" />
            Responses
          </Button>
        </Link>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="size-3" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Body: Left + Center panels */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel — Question List */}
        <div className="w-72 shrink-0 border-r flex flex-col bg-muted/30">
          <div className="px-3 py-3 border-b">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Questions ({questions.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={questions.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                {questions.map((q) => (
                  <SortableQuestionItem
                    key={q.id}
                    question={q}
                    isSelected={q.id === selectedQuestionId}
                    onSelect={() => setSelectedQuestionId(q.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div className="p-3 border-t relative">
            {showTypePicker && (
              <TypePicker
                onSelect={addQuestion}
                onClose={() => setShowTypePicker(false)}
              />
            )}
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => setShowTypePicker((v) => !v)}
            >
              <Plus className="size-3" />
              Add Question
            </Button>
          </div>
        </div>

        {/* Center Panel — Question Editor */}
        <div className="flex-1 overflow-y-auto">
          {selectedQuestion ? (
            <div className="max-w-xl mx-auto p-6">
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="outline" className="text-xs">
                  Q{selectedQuestion.order_index + 1}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {QUESTION_TYPE_MAP[selectedQuestion.type]?.label ??
                    selectedQuestion.type}
                </span>
              </div>
              <QuestionEditor
                question={selectedQuestion}
                onChange={updateQuestion}
                onDelete={() => deleteQuestion(selectedQuestion.id)}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {questions.length === 0
                ? "Add your first question to get started."
                : "Select a question to edit."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
