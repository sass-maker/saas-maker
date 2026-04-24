import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { AIMentionContent } from "./ai-mention-content";
import { getAuthenticatedProject } from "../get-project";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AIMentionPage({ params }: Props) {
  const { slug } = await params;
  const { project } = await getAuthenticatedProject(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Mention Check"
        description="Check if AI assistants mention your product when users ask relevant questions."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
        <AIMentionContent projectId={project.id} />
      </Suspense>
    </div>
  );
}
