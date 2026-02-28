import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { apiFetch, getServerToken } from "@/lib/api";
import type { ProjectRecord, ShortLinkRecord } from "@saasmaker/shared-types";
import { LinksContent } from "./links-content";
import { CreateLinkDialog } from "./create-link-dialog";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function LinksPage({ params }: Props) {
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

  try {
    const res = await apiFetch(
      `/v1/links/dashboard/${project.id}`,
      {},
      token
    );
    total = res.total ?? 0;
  } catch {
    // Links fetch failed — show 0
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Short Links"
        description={`${total} total link${total !== 1 ? "s" : ""}`}
        action={<CreateLinkDialog apiKey={project.api_key} />}
      />

      <Suspense fallback={<TableSkeleton rows={5} columns={6} />}>
        <LinksContent projectId={project.id} apiKey={project.api_key} />
      </Suspense>
    </div>
  );
}
