import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { AIGatewayContent } from "./ai-content";
import { getAuthenticatedProject } from "../get-project";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AIGatewayPage({ params }: Props) {
  const { slug } = await params;
  const { project } = await getAuthenticatedProject(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Gateway"
        description="Proxy LLM calls, track usage, and manage provider configuration."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
        <AIGatewayContent projectId={project.id} apiKey={project.api_key} />
      </Suspense>
    </div>
  );
}
