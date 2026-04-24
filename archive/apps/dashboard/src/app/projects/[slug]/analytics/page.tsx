import { PageHeader } from "@/components/page-header";
import { getAuthenticatedProject } from "../get-project";
import { AnalyticsWrapper } from "./analytics-wrapper";

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
      <AnalyticsWrapper apiKey={project.api_key} />
    </div>
  );
}
