"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
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
    if (!title.trim() || !slug.trim()) return;

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
            <Input
              id="slug"
              placeholder="e.g. feature-request"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              required
              disabled={submitting}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Auto-generated from the title. You can edit it manually.
            </p>
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
            <Button type="submit" disabled={submitting || !title.trim() || !slug.trim()}>
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
