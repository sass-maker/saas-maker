import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { apiFetchAuthed } from '@/lib/api-client';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';
import { getManifestProjectRepos, getManifestProjectSlugs } from '@/lib/fleet-manifest';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { isLocalAuthBypassEnabled } from '@/lib/local-auth';
import { DEFAULT_SYMPHONY_MEMORY } from '@/lib/symphony';

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
  let runs: any[] = [];
  let memory = '';
  const loadErrors: string[] = [];
  const manifestProjects = getManifestProjectSlugs();

  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/tasks');
    tasks = res.data ?? [];
  } catch (error) {
    loadErrors.push(`Tasks failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
    tasks = [];
  }

  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/fleet/metadata');
    projects = visibleDashboardProjects(res.data ?? []).map((p: any) => p.slug);
  } catch (error) {
    loadErrors.push(`Projects failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
    projects = [];
  }

  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/symphony/runs?limit=200');
    runs = res.data ?? [];
  } catch {
    runs = [];
  }

  try {
    const res = await apiFetchAuthed<{ data: { content?: string } }>('/v1/symphony/memory');
    memory = res.data?.content?.trim() ? res.data.content : DEFAULT_SYMPHONY_MEMORY;
  } catch {
    memory = DEFAULT_SYMPHONY_MEMORY;
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
      {loadErrors.length > 0 ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-100">
          <p className="font-medium">Could not sync tasks from SaaS Maker.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {loadErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <TaskBoard
        initialTasks={tasks}
        initialRuns={runs}
        projectSlugs={Array.from(new Set([...manifestProjects, ...projects])).sort()}
        projectRepos={getManifestProjectRepos()}
        initialMemory={memory}
        isLocal={isLocal}
      />
    </div>
  );
}
