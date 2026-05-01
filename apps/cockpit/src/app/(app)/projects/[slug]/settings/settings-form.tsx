"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/copy-button";
import {
  Save,
  Trash2,
  MessageSquare,
  Users,
  Star,
  Megaphone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import type { ProjectRecord } from "@saas-maker/shared-types";

async function getToken(): Promise<string> {
  const res = await fetch("/api/token");
  if (!res.ok) throw new Error("Failed to get auth token");
  const data = await res.json();
  return data.token;
}

interface FeatureCounts {
  feedback: number;
  waitlist: number;
  testimonials: number;
  changelog: number;
}

const features = [
  { key: "feedback" as const, label: "Feedback", icon: MessageSquare, pkg: "@saas-maker/feedback-widget" },
  { key: "waitlist" as const, label: "Waitlist", icon: Users, pkg: "@saas-maker/waitlist-widget" },
  { key: "testimonials" as const, label: "Testimonials", icon: Star, pkg: "@saas-maker/testimonials-widget" },
  { key: "changelog" as const, label: "Changelog", icon: Megaphone, pkg: "@saas-maker/changelog-widget" },
];

interface SettingsFormProps {
  project: ProjectRecord;
  featureCounts?: FeatureCounts;
}

export function SettingsForm({ project, featureCounts }: SettingsFormProps) {
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [notes, setNotes] = useState(project.readme ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const token = await getToken();
      await apiFetch(
        `/v1/projects/${project.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            readme: notes.trim() || null,
          }),
        },
        token
      );
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    name !== project.name ||
    notes !== (project.readme ?? "");

  async function handleDelete() {
    setDeleting(true);
    try {
      const token = await getToken();
      await apiFetch(
        `/v1/projects/${project.id}`,
        { method: "DELETE" },
        token
      );
      router.push("/projects");
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Update the display name and dashboard notes for your project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-notes">Notes</Label>
            <Textarea
              id="project-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What this project does, current owner, next steps, or operational notes."
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              These notes show as the project description in the dashboard.
            </p>
          </div>
          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges || !name.trim()}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>
            Use this key to authenticate your feedback widget.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono select-all">
              {project.api_key}
            </code>
            <CopyButton value={project.api_key} />
          </div>
        </CardContent>
      </Card>

      {/* Enabled Features */}
      {featureCounts && (
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>
              Services enabled for this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const count = featureCounts[f.key];
                const active = count > 0;
                return (
                  <div
                    key={f.key}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <f.icon className={`h-5 w-5 shrink-0 ${active ? "text-foreground" : "text-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${active ? "" : "text-muted-foreground"}`}>
                        {f.label}
                      </p>
                      {f.pkg && (
                        <p className="text-xs text-muted-foreground truncate">{f.pkg}</p>
                      )}
                    </div>
                    <Badge variant={active ? "default" : "secondary"} className="shrink-0">
                      {count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SDK Installation */}
      <Card>
        <CardHeader>
          <CardTitle>SDK Installation</CardTitle>
          <CardDescription>
            Install the feedback widget in your application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto leading-relaxed">
              <code>{`npm install @saas-maker/feedback

import { FeedbackWidget } from '@saas-maker/feedback'

<FeedbackWidget projectId="${project.api_key}" />`}</code>
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton
                value={`npm install @saas-maker/feedback\n\nimport { FeedbackWidget } from '@saas-maker/feedback'\n\n<FeedbackWidget projectId="${project.api_key}" />`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this project and all its feedback data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Project
          </Button>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This will
              permanently remove the project, all feedback data, and API keys.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
