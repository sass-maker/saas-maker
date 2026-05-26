import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { apiFetchAuthed } from '@/lib/api-client';
import { isLocalAuthBypassEnabled } from '@/lib/local-auth';
import { TaskDetailClient } from '@/components/tasks/TaskDetailClient';
import { getCockpitTask, listCockpitRuns, listCockpitTaskComments } from '@/lib/cockpit-tasks-store';
import type { SymphonyRunRow, TaskCommentRow, TaskRow } from '@/components/tasks/TaskBoard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: Props) {
  const requestHeaders = await headers();
  const isLocal = isLocalAuthBypassEnabled(requestHeaders.get('host'));
  if (!isLocal) {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user) redirect('/login');
  }

  const { id } = await params;
  let task: TaskRow;
  let comments: TaskCommentRow[] = [];
  let runs: SymphonyRunRow[] = [];

  if (isLocal) {
    try {
      const res = await apiFetchAuthed<{ data: TaskRow }>(`/v1/tasks/${id}`);
      task = res.data;
    } catch {
      notFound();
    }

    try {
      const res = await apiFetchAuthed<{ data: TaskCommentRow[] }>(`/v1/tasks/${id}/comments`);
      comments = res.data ?? [];
    } catch {
      comments = [];
    }

    try {
      const res = await apiFetchAuthed<{ data: SymphonyRunRow[] }>(`/v1/symphony/runs?task_id=${encodeURIComponent(id)}&limit=20`);
      runs = res.data ?? [];
    } catch {
      runs = [];
    }
  } else {
    task = await getCockpitTask(id) as TaskRow;
    if (!task) notFound();
    [comments, runs] = await Promise.all([
      listCockpitTaskComments(id),
      listCockpitRuns(20, id),
    ]);
  }

  return <TaskDetailClient initialTask={task} initialComments={comments} initialRuns={runs} isLocal={isLocal} />;
}
