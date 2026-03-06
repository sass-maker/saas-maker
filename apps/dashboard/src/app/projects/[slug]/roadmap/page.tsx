import { PageHeader } from "@/components/page-header";
import { CopyButton } from "@/components/copy-button";
import { ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../get-project";
import { RoadmapBoard } from "./roadmap-board";
import type { RoadmapItemRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function RoadmapPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let items: RoadmapItemRecord[] = [];

  try {
    const res = await apiFetch(
      `/v1/roadmap/dashboard/${project.id}`,
      {},
      token
    );
    items = res.data ?? [];
  } catch {
    // Fetch failed
  }

  const publicUrl = `${SITE_URL}/roadmap/${project.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Roadmap" description="Manage your project roadmap" />

      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Public roadmap:</span>
        <code className="flex-1 text-sm font-mono truncate">{publicUrl}</code>
        <CopyButton value={publicUrl} />
      </div>

      <RoadmapBoard projectId={project.id} initialItems={items} />
    </div>
  );
}
