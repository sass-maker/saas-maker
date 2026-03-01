import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { apiFetch, getServerToken } from "@/lib/api";
import type { ProjectRecord } from "@saas-maker/shared-types";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SettingsPage({ params }: Props) {
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
    notFound();
  }

  if (!project) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={project.name} />
      <SettingsForm project={project} />
    </div>
  );
}
