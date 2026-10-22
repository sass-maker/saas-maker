import { ProjectsContent } from './projects-content';
import type { ProjectRecord } from '@saas-maker/contracts';
import { apiFetchAuthed } from '@/lib/api-client';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';
import { getDashboardSession } from '@/lib/server-session';
import { redirect } from 'next/navigation';
import { ProductScoreboard } from '@/components/product-scoreboard';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getDashboardSession();
  if (!session?.user)
    redirect((await searchParams).view === 'scoreboard' ? '/login?returnTo=scoreboard' : '/login');
  if ((await searchParams).view === 'scoreboard') {
    return <ProductScoreboard accountId={session.user.id} />;
  }
  let initialData;
  let initialDataUpdatedAt;
  try {
    const result = await apiFetchAuthed<{ data: ProjectRecord[] }>('/v1/projects');
    initialData = {
      data: visibleDashboardProjects(result.data ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        readme: project.readme,
        source: project.source,
        created_at: project.created_at,
      })),
    };
    initialDataUpdatedAt = Date.now();
  } catch {
    // Let the client resource show loading, retry transient failures and offer retry.
  }
  return <ProjectsContent initialData={initialData} initialDataUpdatedAt={initialDataUpdatedAt} />;
}
