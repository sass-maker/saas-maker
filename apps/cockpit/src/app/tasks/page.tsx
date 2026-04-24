import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { apiFetchAuthed } from '@/lib/api-client';
import { TaskBoard } from '@/components/tasks/TaskBoard';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let tasks: any[] = [];
  let projects: any[] = [];

  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/tasks');
    tasks = res.data ?? [];
  } catch {
    tasks = [];
  }

  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/fleet/metadata');
    projects = (res.data ?? []).map((p: any) => p.slug);
  } catch {
    projects = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create tasks and dispatch them to an AI agent via clipboard.
          </p>
        </div>
      </div>
      <TaskBoard initialTasks={tasks} projectSlugs={projects} />
    </div>
  );
}
