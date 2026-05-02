import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { apiFetchAuthed } from '@/lib/api-client';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';
import { getManifestProjectSlugs } from '@/lib/fleet-manifest';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { isLocalAuthBypassEnabled } from '@/lib/local-auth';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const requestHeaders = await headers();
  const isLocal = isLocalAuthBypassEnabled(requestHeaders.get('host'));
  if (!isLocal) {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user) redirect('/login');
  }

  let tasks: any[] = [];
  let projects: any[] = [];
  let memory = '';
  const manifestProjects = getManifestProjectSlugs();

  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/tasks');
    tasks = res.data ?? [];
  } catch {
    tasks = [];
  }

  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/fleet/metadata');
    projects = visibleDashboardProjects(res.data ?? []).map((p: any) => p.slug);
  } catch {
    projects = [];
  }

  try {
    const res = await apiFetchAuthed<{ data: { content?: string } }>('/v1/symphony/memory');
    memory = res.data?.content ?? '';
  } catch {
    memory = '';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create production tasks, then pull and update them locally with pnpm symphony.
          </p>
        </div>
      </div>
      <TaskBoard
        initialTasks={tasks}
        projectSlugs={Array.from(new Set([...manifestProjects, ...projects])).sort()}
        initialMemory={memory}
        isLocal={isLocal}
      />
    </div>
  );
}
