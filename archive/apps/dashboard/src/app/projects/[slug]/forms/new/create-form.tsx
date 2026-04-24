"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Loader2, Check, X } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface CreateFormProps {
  projectId: string;
  projectSlug: string;
}

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateForm({ projectId, projectSlug }: CreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const checkSlugAvailability = useCallback(async (slugToCheck: string) => {
    if (!slugToCheck.trim()) {
      setSlugAvailable(null);
      setCheckingSlug(false);
      return;
    }
    setCheckingSlug(true);
    try {
      const token = await getClientToken();
      const res = await apiFetchClient<{ available: boolean }>(
        `/v1/forms/dashboard/${projectId}/check-slug/${slugToCheck}`,
        token
      );
      setSlugAvailable(res.available);
    } catch {
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  }, [projectId]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setSlugAvailable(null);
    if (slug.trim()) {
      setCheckingSlug(true);
      debounceRef.current = setTimeout(() => checkSlugAvailability(slug), 400);
    }
    return () => clearTimeout(debounceRef.current);
  }, [slug, checkSlugAvailability]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(titleToSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    setSlug(titleToSlug(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || slugAvailable === false) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = await getClientToken();
      const result = await apiFetchClient<{ data: { id: string } }>(
        `/v1/forms/dashboard/${projectId}`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ title: title.trim(), slug, description: description.trim() || undefined }),
        }
      );
      router.push(`/projects/${projectSlug}/forms/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create form");
      setSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Create a new form</CardTitle>
        <CardDescription>
          Set up a form to collect structured responses from your users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Feature Request"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="relative">
              <Input
                id="slug"
                placeholder="e.g. feature-request"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                required
                disabled={submitting}
                className={`font-mono pr-8 ${slugAvailable === false ? "border-destructive" : slugAvailable === true ? "border-green-500" : ""}`}
              />
              {slug.trim() && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {checkingSlug ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : slugAvailable === true ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : slugAvailable === false ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : null}
                </div>
              )}
            </div>
            {slugAvailable === false ? (
              <p className="text-xs text-destructive">This slug is already taken. Choose a different one.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Auto-generated from the title. You can edit it manually.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="A short description of what this form collects..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={submitting || !title.trim() || !slug.trim() || slugAvailable === false || checkingSlug}>
              {submitting && <Loader2 className="animate-spin" />}
              Create Form
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
