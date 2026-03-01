import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { AnalyticsContent } from "./analytics-content";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getServerToken, getProjectBySlug } from "@/lib/api";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AnalyticsPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const token = await getServerToken();

  const project = await getProjectBySlug(slug, token);
  if (!project) notFound();

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
