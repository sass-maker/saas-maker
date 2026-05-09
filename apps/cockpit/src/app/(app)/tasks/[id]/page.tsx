import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { apiFetchAuthed } from '@/lib/api-client';
import { isLocalAuthBypassEnabled } from '@/lib/local-auth';
import { TaskDetailClient } from '@/components/tasks/TaskDetailClient';
import type { TaskCommentRow, TaskRow } from '@/components/tasks/TaskBoard';

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

  return <TaskDetailClient initialTask={task} initialComments={comments} />;
}
