import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { AnalyticsContent } from "./analytics-content";
import { getAuthenticatedProject } from "../get-project";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AnalyticsPage({ params }: Props) {
  const { slug } = await params;
  const { project } = await getAuthenticatedProject(slug);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Privacy-friendly page views and custom event tracking."
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={3} />}>
        <AnalyticsContent projectId={project.id} />
      </Suspense>
    </div>
  );
}
