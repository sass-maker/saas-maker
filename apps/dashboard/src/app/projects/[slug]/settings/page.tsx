import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";
import { getAuthenticatedProject } from "../get-project";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

interface FeatureCounts {
  feedback: number;
  waitlist: number;
  testimonials: number;
  links: number;
  indexes: number;
  changelog: number;
}

export default async function SettingsPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  // Fetch feature counts in parallel
  const counts: FeatureCounts = {
    feedback: 0,
    waitlist: 0,
    testimonials: 0,
    links: 0,
    indexes: 0,
    changelog: 0,
  };

  try {
    const [fb, wl, tm, lk, ix, cl] = await Promise.allSettled([
      apiFetch(`/v1/feedback/dashboard/${project.id}?limit=1`, {}, token),
      apiFetch(`/v1/waitlist?project_id=${project.id}`, {}, token),
      apiFetch(`/v1/testimonials/all?project_id=${project.id}`, {}, token),
      apiFetch(`/v1/links/dashboard/${project.id}`, {}, token),
      apiFetch(`/v1/indexes/dashboard/${project.id}`, {}, token),
      apiFetch(`/v1/changelog/dashboard/${project.id}`, {}, token),
    ]);

    if (fb.status === "fulfilled") counts.feedback = fb.value.total ?? 0;
    if (wl.status === "fulfilled") counts.waitlist = wl.value.total ?? 0;
    if (tm.status === "fulfilled") counts.testimonials = tm.value.total ?? 0;
    if (lk.status === "fulfilled") counts.links = lk.value.total ?? 0;
    if (ix.status === "fulfilled") counts.indexes = ix.value.data?.length ?? 0;
    if (cl.status === "fulfilled") counts.changelog = cl.value.total ?? 0;
  } catch {
    // Counts stay at 0
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={project.name} />
      <SettingsForm project={project} featureCounts={counts} />
    </div>
  );
}
