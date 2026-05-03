'use client';

import { useState, useCallback } from 'react';
import { Bot, ChevronDown, Clipboard, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { buildSymphonyPrompt, chooseSymphonyAgent } from '@/lib/symphony';
import { cn } from '@/lib/utils';

export interface TaskRow {
  id: string;
  owner_id: string;
  project_slug: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  task_type: 'feature' | 'bug' | 'chore' | 'docs' | 'research' | 'cleanup' | 'other';
  created_at: string;
  updated_at: string;
}

const PRIORITY_DOT: Record<TaskRow['priority'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-muted-foreground/50',
};

const PRIORITY_LABEL: Record<TaskRow['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_RANK: Record<TaskRow['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const TASK_TYPE_LABEL: Record<TaskRow['task_type'], string> = {
  feature: 'Feature',
  bug: 'Bug',
  chore: 'Chore',
  docs: 'Docs',
  research: 'Research',
  cleanup: 'Cleanup',
  other: 'Other',
};

const STATUS_LABEL: Record<TaskRow['status'], string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

const STATUS_DOT_CLASS: Record<TaskRow['status'], string> = {
  todo: 'border-muted-foreground/50 bg-transparent',
  in_progress: 'border-blue-500 bg-blue-500/15',
  done: 'border-emerald-500 bg-emerald-500/15',
};

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
  task_type: string;
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  project_slug: '',
  priority: 'medium',
  task_type: 'feature',
};

const ALL_PROJECTS = '__all__';
const UNASSIGNED_PROJECT = '__unassigned__';
const ALL_PRIORITIES = '__all__';

function sortTasksByPriority(tasks: TaskRow[]) {
  return [...tasks].sort((a, b) => {
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function taskPreview(description: string | null) {
  return description?.split(/\s+Source:\s+/)[0]?.trim() ?? '';
}

export function TaskBoard({
  initialTasks,
  projectSlugs,
  initialMemory,
  isLocal,
}: {
  initialTasks: TaskRow[];
  projectSlugs: string[];
  initialMemory: string;
  isLocal: boolean;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [memory, setMemory] = useState(initialMemory);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [runTask, setRunTask] = useState<TaskRow | null>(null);
  const [runInstructions, setRunInstructions] = useState('');
  const [startingRun, setStartingRun] = useState(false);
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [priorityFilter, setPriorityFilter] = useState(ALL_PRIORITIES);
  const [showDone, setShowDone] = useState(false);

  const allProjectSlugs = Array.from(
    new Set([
      ...projectSlugs,
      ...tasks.map(task => task.project_slug).filter((slug): slug is string => Boolean(slug)),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const filteredTasks = sortTasksByPriority(
    tasks.filter(task => {
      const matchesProject =
        projectFilter === ALL_PROJECTS ||
        (projectFilter === UNASSIGNED_PROJECT ? !task.project_slug : task.project_slug === projectFilter);
      const matchesPriority = priorityFilter === ALL_PRIORITIES || task.priority === priorityFilter;
      const matchesStatus = showDone || task.status !== 'done';
      return matchesProject && matchesPriority && matchesStatus;
    })
  );

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
      task_type: task.task_type ?? 'feature',
    });
    setModalOpen(true);
  };

  const openRun = (task: TaskRow) => {
    setRunTask(task);
    setRunInstructions('');
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
            task_type: form.task_type,
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
            task_type: form.task_type,
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

  const handlePriorityChange = async (task: TaskRow, newPriority: TaskRow['priority']) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: newPriority } : t));
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/tasks/${task.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ priority: newPriority }),
      });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: task.priority } : t));
      showToast('Failed to update priority');
    }
  };

  const handleTypeChange = async (task: TaskRow, newType: TaskRow['task_type']) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, task_type: newType } : t));
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/tasks/${task.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ task_type: newType }),
      });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, task_type: task.task_type } : t));
      showToast('Failed to update type');
    }
  };

  const handleMemorySave = async () => {
    setSavingMemory(true);
    try {
      const token = await getClientToken();
      await apiFetchClient('/v1/symphony/memory', token, {
        method: 'PUT',
        body: JSON.stringify({ content: memory }),
      });
      showToast('Memory saved');
    } catch {
      showToast('Failed to save memory');
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDispatch = async (task: TaskRow, additionalInstructions = '') => {
    setStartingRun(true);
    if (!isLocal) {
      try {
        await navigator.clipboard.writeText(buildSymphonyPrompt(task, memory, additionalInstructions));
        showToast('Prompt copied');
      } catch {
        showToast('Copy failed');
      } finally {
        setStartingRun(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, memory, additionalInstructions }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json() as { route?: { label?: string } };
      showToast(`${result.route?.label ?? 'Agent'} started`);
      setRunTask(null);
      setRunInstructions('');
      if (task.status === 'todo') {
        await handleStatusChange(task, 'in_progress');
      }
    } catch {
      showToast('Failed to start agent');
    } finally {
      setStartingRun(false);
    }
  };

  const copyRunPrompt = async () => {
    if (!runTask) return;
    try {
      await navigator.clipboard.writeText(buildSymphonyPrompt(runTask, memory, runInstructions));
      showToast('Prompt copied');
    } catch {
      showToast('Copy failed');
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="project-filter" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Project
              </Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger id="project-filter" className="h-9 w-[min(20rem,calc(100vw-2rem))]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                  <SelectItem value={UNASSIGNED_PROJECT}>Unassigned</SelectItem>
                  {allProjectSlugs.map(slug => (
                    <SelectItem key={slug} value={slug}>{slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="priority-filter" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Priority
              </Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger id="priority-filter" className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PRIORITIES}>All priorities</SelectItem>
                  <SelectItem value="high">High first</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {filteredTasks.length} / {tasks.length} tasks
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDone(prev => !prev)}
              className="h-9"
            >
              {showDone ? 'Hide done' : 'Show done'}
            </Button>
          </div>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Tasks sort by priority first, then latest update. Production tasks are shared across the dashboard, pnpm symphony, and whichever local agent command you dispatch.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      <TaskList
        tasks={filteredTasks}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRun={handleDispatch}
        onCustomizeRun={openRun}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        onTypeChange={handleTypeChange}
        isLocal={isLocal}
      />

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Symphony Memory</h2>
            <p className="text-xs text-muted-foreground">
              Shared instructions that get injected into every copied prompt and local run.
            </p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={handleMemorySave} disabled={savingMemory}>
            <Save className="mr-1.5 h-4 w-4" />
            {savingMemory ? 'Saving...' : 'Save Memory'}
          </Button>
        </div>
        <Textarea
          value={memory}
          onChange={e => setMemory(e.target.value)}
          rows={7}
          className="max-h-64 min-h-32 resize-y font-mono text-xs"
          placeholder="Persistent operating preferences for Symphony agents..."
        />
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[min(44rem,calc(100vw-2rem))] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-2 space-y-5">
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
                rows={7}
                className="min-h-40 resize-y"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="max-w-xs space-y-1.5">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.task_type}
                  onValueChange={v => setForm(f => ({ ...f, task_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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

      <Dialog open={!!runTask} onOpenChange={open => {
        if (!open) {
          setRunTask(null);
          setRunInstructions('');
        }
      }}>
        <DialogContent className="w-[min(52rem,calc(100vw-2rem))] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run Task</DialogTitle>
          </DialogHeader>
          {runTask && (
            <div className="mt-2 space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Routed agent
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {chooseSymphonyAgent(runTask, memory, runInstructions).label}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Auto from Symphony memory + task metadata
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {chooseSymphonyAgent(runTask, memory, runInstructions).reason}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Symphony Instructions</Label>
                <Textarea
                  value={buildSymphonyPrompt(runTask, memory, runInstructions)}
                  readOnly
                  rows={12}
                  className="max-h-72 min-h-56 resize-y font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="run-instructions">Custom Instructions</Label>
                <Textarea
                  id="run-instructions"
                  value={runInstructions}
                  onChange={e => setRunInstructions(e.target.value)}
                  rows={5}
                  className="min-h-28 resize-y"
                  placeholder="Add one-off guidance for this run..."
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setRunTask(null);
                  setRunInstructions('');
                }}>
                  Cancel
                </Button>
                <Button type="button" variant="secondary" onClick={copyRunPrompt}>
                  <Clipboard className="h-4 w-4" />
                  Copy Prompt
                </Button>
                <Button type="button" onClick={() => handleDispatch(runTask, runInstructions)} disabled={startingRun}>
                  <Bot className="h-4 w-4" />
                  {startingRun ? 'Starting...' : isLocal ? 'Start Run' : 'Copy Prompt'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {toast && <Toast message={toast} />}
    </>
  );
}

function TaskList({
  tasks,
  onEdit,
  onDelete,
  onRun,
  onCustomizeRun,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
  isLocal,
}: {
  tasks: TaskRow[];
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
  onRun: (t: TaskRow) => void;
  onCustomizeRun: (t: TaskRow) => void;
  onStatusChange: (t: TaskRow, s: TaskRow['status']) => void;
  onPriorityChange: (t: TaskRow, p: TaskRow['priority']) => void;
  onTypeChange: (t: TaskRow, p: TaskRow['task_type']) => void;
  isLocal: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No tasks match this project filter.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/35">
      {tasks.map(task => {
        const preview = taskPreview(task.description);
        const metadataPillClass = 'inline-flex h-7 items-center rounded-full border border-border/60 bg-background/35 px-3 text-xs font-normal text-muted-foreground shadow-none';
        const metadataSelectClass = cn(
          metadataPillClass,
          'cursor-pointer appearance-none py-0 pr-7 hover:border-border hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35'
        );
        return (
          <article
            key={task.id}
            className="group grid min-h-[5rem] grid-cols-[2.25rem_minmax(0,1fr)_5.5rem] items-center gap-0 px-2 py-3 transition-colors hover:bg-muted/20 max-sm:grid-cols-[2rem_minmax(0,1fr)]"
          >
            <div className="flex items-center justify-center">
              <span
                className={cn('h-4 w-4 rounded-full border-2', STATUS_DOT_CLASS[task.status])}
                title={STATUS_LABEL[task.status]}
              />
            </div>
            <div className="min-w-0 px-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <h3 className="truncate text-base font-medium leading-6 text-foreground">
                  {task.title}
                </h3>
              </div>
              {preview && (
                <p className="max-w-2xl truncate text-sm leading-5 text-muted-foreground">
                  {preview}
                </p>
              )}
              <div className="mt-1 flex min-w-0 items-center gap-1 max-sm:hidden">
                <span className={cn(metadataPillClass, 'max-w-32 hover:border-border hover:bg-background/70')}>
                  <span className="truncate">{task.project_slug ?? 'Unassigned'}</span>
                </span>
                <span className="relative inline-flex">
                  <select
                    value={task.task_type}
                    onChange={event => onTypeChange(task, event.target.value as TaskRow['task_type'])}
                    className={cn(metadataSelectClass, 'w-[5.75rem]')}
                    aria-label={`Type for ${task.title}`}
                  >
                    {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground opacity-35" />
                </span>
                <span className="relative inline-flex">
                  <span className={cn('pointer-events-none absolute left-3 top-1/2 z-10 h-2 w-2 -translate-y-1/2 rounded-full', PRIORITY_DOT[task.priority])} />
                  <select
                    value={task.priority}
                    onChange={event => onPriorityChange(task, event.target.value as TaskRow['priority'])}
                    className={cn(metadataSelectClass, 'w-[5.25rem] pl-7')}
                    aria-label={`Priority for ${task.title}`}
                  >
                    {(['high', 'medium', 'low'] as const).map(priority => (
                      <option key={priority} value={priority}>{PRIORITY_LABEL[priority]}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground opacity-35" />
                </span>
              </div>
            </div>
            <div className="flex min-w-0 items-center justify-end gap-1 max-sm:hidden">
              {task.status === 'todo' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRun(task)}
                  onContextMenu={event => {
                    event.preventDefault();
                    onCustomizeRun(task);
                  }}
                  title="Right-click to customize instructions before running"
                  className="h-8 rounded-full px-3 text-sm text-muted-foreground opacity-80 hover:text-foreground hover:opacity-100"
                >
                  <Bot className="h-3.5 w-3.5" />
                  {isLocal ? 'Run' : 'Copy prompt'}
                </Button>
              )}
              {task.status === 'in_progress' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(task, 'todo')}
                  className="h-8 rounded-full px-3 text-sm"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" onClick={() => onEdit(task)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100" onClick={() => onDelete(task)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
