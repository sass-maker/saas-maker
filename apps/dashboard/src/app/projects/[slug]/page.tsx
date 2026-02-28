import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InboxContent } from "./inbox-content";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { apiFetch, getServerToken } from "@/lib/api";
import type { ProjectRecord } from "@saasmaker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjectInboxPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const token = await getServerToken();

  let project: ProjectRecord | undefined;

  try {
    const res = await apiFetch("/v1/projects", {}, token);
    const projects: ProjectRecord[] = res.data ?? [];
    project = projects.find((p) => p.slug === slug);
  } catch {
    // Auth failed — fall through to notFound
  }

  if (!project) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader title={project.name} description="Feedback inbox" />

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
        <InboxContent slug={project.slug} />
      </Suspense>
    </div>
  );
}
