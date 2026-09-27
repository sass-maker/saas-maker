import { PageHeader } from '@/components/page-header';
import { getDashboardSession } from '@/lib/server-session';
import { apiFetch, getServerToken } from '@/lib/api';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';
import { redirect } from 'next/navigation';
import type { ProjectRecord } from '@saas-maker/contracts';
import { SubscribersBoard } from './subscribers-board';

export const dynamic = 'force-dynamic';

export default async function SubscribersPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  const token = await getServerToken();
  let projects: { name: string; slug: string }[] = [];
  try {
    const res = (await apiFetch('/v1/projects', {}, token)) as { data?: ProjectRecord[] };
    projects = visibleDashboardProjects(res.data ?? []).map((project) => ({
      name: project.name,
      slug: project.slug,
    }));
  } catch {
    // The project filter is best-effort; the board still loads without it.
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscribers"
        description="Consented newsletter and waitlist sign-ups captured across products."
      />
      <SubscribersBoard projects={projects} />
    </div>
  );
}
