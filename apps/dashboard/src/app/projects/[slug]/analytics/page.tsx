import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { AnalyticsContent } from "./analytics-content";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { apiFetch, getServerToken } from "@/lib/api";
import type { ProjectRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AnalyticsPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const token = await getServerToken();

  let project: ProjectRecord | undefined;
  try {
    const res = await apiFetch("/v1/projects", {}, token);
    const projects: ProjectRecord[] = res.data ?? [];
    project = projects.find((p) => p.slug === slug);
  } catch {}

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
