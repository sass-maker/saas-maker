import { PageHeader } from "@/components/page-header";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../get-project";
import { ProgressBoard } from "./progress-board";
import type {
  ChangelogEntryRecord,
  RoadmapItemRecord,
} from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProgressPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let roadmap: RoadmapItemRecord[] = [];
  let changelog: ChangelogEntryRecord[] = [];

  try {
    const [roadmapRes, changelogRes] = await Promise.all([
      apiFetch(`/v1/roadmap/dashboard/${project.id}`, {}, token),
      apiFetch(`/v1/changelog/dashboard/${project.id}`, {}, token),
    ]);
    roadmap = roadmapRes.data ?? [];
    changelog = changelogRes.data ?? [];
  } catch {
    // Individual board actions still work once the client token is available.
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress"
        description="Public product progress, separate from internal Cockpit tasks."
      />

      <ProgressBoard
        projectId={project.id}
        initialRoadmap={roadmap}
        initialChangelog={changelog}
      />
    </div>
  );
}
