import { ProjectContent } from './project-content';
import { notFound } from 'next/navigation';
import { getProjectBySlug, getServerToken } from '@/lib/api';
import { getDashboardSession } from '@/lib/server-session';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProjectStatusPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');
  const { slug } = await params;
  let project;
  let initialData;
  let initialDataUpdatedAt;
  try {
    project = await getProjectBySlug(encodeURIComponent(slug), await getServerToken());
    if (project) {
      initialData = {
        id: project.id,
        name: project.name,
        slug: project.slug,
        api_key: project.api_key,
      };
      initialDataUpdatedAt = Date.now();
    }
  } catch {
    // An unavailable API is not a missing project. The client resource can retry.
  }
  if (project === null) notFound();
  return <ProjectContent initialData={initialData} initialDataUpdatedAt={initialDataUpdatedAt} />;
}
