import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { InboxContent } from "./inbox-content";
import { CopyButton } from "@/components/copy-button";

// Mock project data — will be fetched from API later
const MOCK_PROJECT = {
  id: "1",
  name: "Acme SaaS",
  slug: "acme-saas",
  api_key: "pk_live_abc123def456ghi789",
  owner_id: "user-1",
  created_at: "2026-02-20T10:00:00Z",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjectInboxPage({ params }: Props) {
  const { slug } = await params;
  // TODO: Fetch project by slug from API
  const project = { ...MOCK_PROJECT, slug };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">Feedback inbox</p>
        </div>
        <Link href={`/projects/${project.slug}/settings`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>

      {/* API Key + SDK snippet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
              {project.api_key}
            </code>
            <CopyButton value={project.api_key} />
          </div>
          <pre className="rounded bg-muted p-3 text-xs font-mono overflow-x-auto">
{`npm install @saasmaker/feedback

import { FeedbackWidget } from '@saasmaker/feedback'

<FeedbackWidget projectId="${project.api_key}" />`}
          </pre>
        </CardContent>
      </Card>

      {/* Filters + Table */}
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <InboxContent />
      </Suspense>
    </div>
  );
}
