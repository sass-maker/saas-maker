import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { apiFetchAuthed } from '@/lib/api-client';
import { getManifestProjectRepos, getManifestProjectSlugs } from '@/lib/fleet-manifest';
import { sortProjectSlugs } from '@/lib/fleet-project-names';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { ensureCockpitUser, getCockpitSymphonyMemory, getDefaultCockpitOwnerId, listCockpitProjectSlugs, listCockpitRuns, listCockpitTasks } from '@/lib/cockpit-tasks-store';
import { isLocalAuthBypassEnabled } from '@/lib/local-auth';
import { DEFAULT_SYMPHONY_MEMORY } from '@/lib/symphony';
import { CheckCircle2, ListTodo, ShieldAlert } from 'lucide-react';

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

  if (isLocal) {
    try {
      const res = await apiFetchAuthed<{ data: any[] }>('/v1/tasks');
      tasks = res.data ?? [];
    } catch (error) {
      loadErrors.push(`Tasks failed to load: ${error instanceof Error ? error.message : 'Unknown error'}`);
      tasks = [];
    }

    try {
      const res = await apiFetchAuthed<{ data: any[] }>('/v1/fleet/metadata');
      projects = (res.data ?? []).map((p: any) => p.slug).filter(Boolean);
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
  } else {
    const session = await auth.api.getSession({ headers: requestHeaders });
    try {
      [tasks, projects, runs, memory] = await Promise.all([
        listCockpitTasks(),
        listCockpitProjectSlugs(),
        listCockpitRuns(200),
        (getDefaultCockpitOwnerId().then(ownerId => ownerId ?? ensureCockpitUser(session!.user))).then(ownerId =>
          getCockpitSymphonyMemory(ownerId).then(content => content.trim() ? content : DEFAULT_SYMPHONY_MEMORY)
        ),
      ]);
    } catch (error) {
      loadErrors.push(`Cockpit D1 read failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
              <ListTodo className="h-3.5 w-3.5" />
              Symphony task control
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Tasks</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Create production tasks, route them to agents, and pull them locally with pnpm symphony.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs sm:w-[25rem]">
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ListTodo className="h-3.5 w-3.5" />
                Total
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-foreground">{tasks.length}</div>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" />
                Open
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-300">
                {tasks.filter(task => task.status !== 'done').length}
              </div>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Done
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-300">
                {tasks.filter(task => task.status === 'done').length}
              </div>
            </div>
          </div>
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
        projectSlugs={sortProjectSlugs(Array.from(new Set([...manifestProjects, ...projects])))}
        projectRepos={getManifestProjectRepos()}
        initialMemory={memory}
        isLocal={isLocal}
      />
    </div>
  );
}
