"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/copy-button";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";

// Mock project data — will be fetched from API later
const MOCK_PROJECT = {
  id: "1",
  name: "Acme SaaS",
  slug: "acme-saas",
  api_key: "pk_live_abc123def456ghi789",
  owner_id: "user-1",
  created_at: "2026-02-20T10:00:00Z",
};

export default function SettingsPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const project = { ...MOCK_PROJECT, slug: params.slug };

  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // TODO: Call API to update project name
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      // TODO: Call API to delete project
      await new Promise((r) => setTimeout(r, 500));
      router.push("/projects");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/projects/${project.slug}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {/* Project Name */}
      <Card>
        <CardHeader>
          <CardTitle>Project Name</CardTitle>
          <CardDescription>
            Update the display name for your project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            onClick={handleSave}
            disabled={saving || name === project.name || !name.trim()}
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
              <code>{`npm install @saasmaker/feedback

import { FeedbackWidget } from '@saasmaker/feedback'

<FeedbackWidget projectId="${project.api_key}" />`}</code>
            </pre>
            <div className="absolute top-2 right-2">
              <CopyButton
                value={`npm install @saasmaker/feedback\n\nimport { FeedbackWidget } from '@saasmaker/feedback'\n\n<FeedbackWidget projectId="${project.api_key}" />`}
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
