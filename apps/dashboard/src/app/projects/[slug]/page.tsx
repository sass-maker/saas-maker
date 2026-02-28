import { Suspense } from "react";
import { InboxContent } from "./inbox-content";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { CopyButton } from "@/components/copy-button";
import { MessageSquare, Lightbulb, Bug, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { apiFetch, getServerToken } from "@/lib/api";
import type { ProjectRecord, FeedbackRecord } from "@saasmaker/shared-types";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

  let total = 0;
  let features = 0;
  let bugs = 0;

  try {
    const res = await apiFetch(
      `/v1/feedback?project_id=${project.id}`,
      {},
      token
    );
    const items: FeedbackRecord[] = res.data ?? [];
    total = res.total ?? items.length;
    features = items.filter((i) => i.type === "feature").length;
    bugs = items.filter((i) => i.type === "bug").length;
  } catch {
    // Feedback fetch failed — show zeros
  }

  const publicBoardUrl = `${SITE_URL}/f/${project.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} description="Feedback inbox" />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Feedback" value={total} icon={MessageSquare} />
        <StatCard title="Feature Requests" value={features} icon={Lightbulb} />
        <StatCard title="Bug Reports" value={bugs} icon={Bug} />
      </div>

      {/* Public board link */}
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Public board:</span>
        <code className="flex-1 text-sm font-mono truncate">{publicBoardUrl}</code>
        <CopyButton value={publicBoardUrl} />
      </div>

      {/* Filters + Table */}
      <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
        <InboxContent slug={project.slug} />
      </Suspense>
    </div>
  );
}
