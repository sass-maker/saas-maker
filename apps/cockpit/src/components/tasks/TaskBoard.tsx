'use client';

import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { buildSymphonyCommand } from '@/lib/symphony';
import { cn } from '@/lib/utils';

export interface TaskRow {
  id: string;
  owner_id: string;
  project_slug: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

const COLUMNS: { key: TaskRow['status']; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_DOT: Record<TaskRow['priority'], string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-500',
};

const AGENT_OPTIONS = [
  { value: 'codex', label: 'Codex' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'custom', label: 'Custom' },
];

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg animate-in fade-in slide-in-from-bottom-2">
      {message}
    </div>
  );
}

interface TaskFormData {
  title: string;
  description: string;
  project_slug: string;
  priority: string;
  status: string;
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  project_slug: '',
  priority: 'medium',
  status: 'todo',
};

export function TaskBoard({
  initialTasks,
  projectSlugs,
}: {
  initialTasks: TaskRow[];
  projectSlugs: string[];
}) {
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState('codex');
  const [agentCommand, setAgentCommand] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const openCreate = () => {
    setEditTask(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (task: TaskRow) => {
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      project_slug: task.project_slug ?? '',
      priority: task.priority,
      status: task.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const token = await getClientToken();
      if (editTask) {
        const res = await apiFetchClient<{ data: TaskRow }>(`/v1/tasks/${editTask.id}`, token, {
          method: 'PATCH',
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description || undefined,
            project_slug: form.project_slug || undefined,
            priority: form.priority,
            status: form.status,
          }),
        });
        setTasks(prev => prev.map(t => t.id === editTask.id ? res.data : t));
        showToast('Task updated');
      } else {
        const res = await apiFetchClient<{ data: TaskRow }>('/v1/tasks', token, {
          method: 'POST',
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description || undefined,
            project_slug: form.project_slug || undefined,
            priority: form.priority,
          }),
        });
        setTasks(prev => [res.data, ...prev]);
        showToast('Task created');
      }
      setModalOpen(false);
    } catch {
      showToast('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: TaskRow) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/tasks/${task.id}`, token, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== task.id));
      showToast('Task deleted');
    } catch {
      showToast('Failed to delete task');
    }
  };

  const handleStatusChange = async (task: TaskRow, newStatus: TaskRow['status']) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/tasks/${task.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      showToast('Failed to update status');
    }
  };

  const handleDispatch = async (task: TaskRow) => {
    const command = buildSymphonyCommand(task, {
      agent: agent === 'custom' ? undefined : agent,
      agentCommand: agent === 'custom' ? agentCommand : undefined,
    });
    try {
      await navigator.clipboard.writeText(command);
      showToast('Symphony command copied — task claimed');
      if (task.status === 'todo') {
        await handleStatusChange(task, 'in_progress');
      }
    } catch {
      showToast('Copy failed');
    }
  };

  const tasksByStatus = (status: TaskRow['status']) => tasks.filter(t => t.status === status);

  return (
    <>
      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select value={agent} onValueChange={setAgent}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agent === 'custom' && (
              <Input
                value={agentCommand}
                onChange={e => setAgentCommand(e.target.value)}
                placeholder="agent --full-access --prompt-file {promptFile}"
                className="h-9 w-[260px]"
              />
            )}
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Task
            </Button>
          </div>
          <p className="max-w-lg text-right text-xs text-muted-foreground">
            Production tasks are shared across the dashboard, pnpm symphony, and whichever local agent command you dispatch.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map(col => (
          <div key={col.key} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {col.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {tasksByStatus(col.key).length}
              </span>
            </div>
            <div className="flex flex-col gap-2 min-h-[4rem]">
              {tasksByStatus(col.key).map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onDispatch={handleDispatch}
                  onStatusChange={handleStatusChange}
                />
              ))}
              {tasksByStatus(col.key).length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select
                  value={form.project_slug}
                  onValueChange={v => setForm(f => ({ ...f, project_slug: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {projectSlugs.map(slug => (
                      <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={v => setForm(f => ({ ...f, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editTask && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={v => setForm(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">Todo</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : editTask ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {toast && <Toast message={toast} />}
    </>
  );
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onDispatch,
  onStatusChange,
}: {
  task: TaskRow;
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
  onDispatch: (t: TaskRow) => void;
  onStatusChange: (t: TaskRow, s: TaskRow['status']) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn('h-2 w-2 rounded-full shrink-0 mt-0.5', PRIORITY_DOT[task.priority])}
            title={`Priority: ${task.priority}`}
          />
          <span className="font-semibold text-sm leading-snug truncate">{task.title}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDispatch(task)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Dispatch with Symphony"
          >
            <Bot className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(task)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground truncate">{task.description}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {task.project_slug && (
          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
            {task.project_slug}
          </Badge>
        )}
        <Select
          value={task.status}
          onValueChange={v => onStatusChange(task, v as TaskRow['status'])}
        >
          <SelectTrigger className="h-5 text-xs px-1.5 py-0 border-0 bg-muted/50 hover:bg-muted w-auto gap-1 focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
