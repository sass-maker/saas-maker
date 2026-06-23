'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  ExternalLink,
  FileText,
  GitBranch,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { formatProjectLabel, sortProjectSlugs } from '@/lib/fleet-project-names';
import {
  buildSymphonyBatchPrompt,
  buildSymphonyDoneCommand,
  buildSymphonyPrompt,
  buildSymphonyRunRecord,
  chooseSymphonyAgent,
  type SymphonyAgentUsageSnapshot,
} from '@/lib/symphony';
import { cn } from '@/lib/utils';
import {
  DroidDialog,
  type DroidMode,
  type DroidRunArtifact,
  type DroidRunEvent,
  type DroidRunRow,
  type DroidRunStats,
} from './DroidDialog';

export interface TaskRow {
  id: string;
  owner_id: string;
  project_slug: string | null;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  task_type: 'feature' | 'bug' | 'chore' | 'docs' | 'research' | 'cleanup' | 'other';
  dependencies?: string[];
  branch_name: string | null;
  pr_url: string | null;
  pr_status: 'none' | 'draft' | 'open' | 'merged' | 'closed';
  commit_sha: string | null;
  deployment_url: string | null;
  deployment_status: 'none' | 'pending' | 'success' | 'failed';
  blocked_on_user: boolean;
  has_changelog?: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskCommentRow {
  id: string;
  owner_id: string;
  task_id: string;
  author_type: 'user' | 'agent';
  body: string;
  resolves_blocker: boolean;
  marks_done: boolean;
  created_at: string;
}

export interface SymphonyRunRow {
  id?: string;
  task_id: string | null;
  project_slug: string | null;
  agent_profile: string | null;
  model_profile: string | null;
  command_template: string;
  pid: number | null;
  status: string;
  workspace_path: string | null;
  prompt_path: string | null;
  terminal_hint: string | null;
  log_hint: string | null;
  cost_note: string | null;
  token_note: string | null;
  metadata?: string | Record<string, unknown>;
  started_at: string;
  created_at?: string;
}

async function taskBoardFetch<T>(path: string, isLocal: boolean, init?: RequestInit): Promise<T> {
  if (isLocal) {
    const token = await getClientToken();
    return apiFetchClient<T>(path, token, init);
  }
  const cockpitPath = path.replace(/^\/v1/, '/api/cockpit');
  const res = await fetch(cockpitPath, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error((await res.text()) || `Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

function getDependencies(task: TaskRow): string[] {
  return Array.isArray(task.dependencies) ? task.dependencies : [];
}

function isTaskBlocked(task: TaskRow, byId: Map<string, TaskRow>): boolean {
  if (task.blocked_on_user) return true;
  const deps = getDependencies(task);
  if (deps.length === 0) return false;
  return deps.some((id) => {
    const prereq = byId.get(id);
    return prereq?.status !== 'done';
  });
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

const PR_STATUS_LABEL: Record<TaskRow['pr_status'], string> = {
  none: 'No PR',
  draft: 'Draft PR',
  open: 'Open PR',
  merged: 'Merged',
  closed: 'Closed',
};

const DEPLOYMENT_STATUS_LABEL: Record<TaskRow['deployment_status'], string> = {
  none: 'No deploy',
  pending: 'Deploying',
  success: 'Deployed',
  failed: 'Deploy failed',
};

const LIFECYCLE_BADGE_CLASS: Record<TaskRow['pr_status'] | TaskRow['deployment_status'], string> = {
  none: 'border-border/60 bg-background/35 text-muted-foreground',
  draft: 'border-slate-500/40 bg-slate-500/10 text-slate-500 dark:text-slate-300',
  open: 'border-blue-500/45 bg-blue-500/10 text-blue-600 dark:text-blue-300',
  merged: 'border-violet-500/45 bg-violet-500/10 text-violet-600 dark:text-violet-300',
  closed: 'border-zinc-500/45 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
  pending: 'border-amber-500/45 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  success: 'border-emerald-500/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  failed: 'border-red-500/45 bg-red-500/10 text-red-600 dark:text-red-300',
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
  branch_name: string;
  pr_url: string;
  pr_status: TaskRow['pr_status'];
  commit_sha: string;
  deployment_url: string;
  deployment_status: TaskRow['deployment_status'];
  blocked_on_user: boolean;
  dependencies: string[];
}

const EMPTY_FORM: TaskFormData = {
  title: '',
  description: '',
  project_slug: '',
  priority: 'medium',
  task_type: 'feature',
  branch_name: '',
  pr_url: '',
  pr_status: 'none',
  commit_sha: '',
  deployment_url: '',
  deployment_status: 'none',
  blocked_on_user: false,
  dependencies: [],
};

const ALL_PROJECTS = '__all__';
const UNASSIGNED_PROJECT = '__unassigned__';
const ALL_PRIORITIES = '__all__';
const ALL_LANES = '__all__';
const ALL_WORKSTREAMS = '__all__';

type ProductLane = 'P0' | 'P1' | 'P2' | 'Core';
type WorkstreamFilter = typeof ALL_WORKSTREAMS | 'product' | 'marketing';

const PRODUCT_LANE_ORDER: ProductLane[] = ['P0', 'P1', 'P2', 'Core'];

const PRODUCT_LANE_LABEL: Record<ProductLane, string> = {
  P0: 'P0 · Urgent product',
  P1: 'P1 · Important product',
  P2: 'P2 · Nice-to-have',
  Core: 'Core · Platform & upkeep',
};

const PRODUCT_LANE_BADGE: Record<ProductLane, string> = {
  P0: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-300',
  P1: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  P2: 'border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  Core: 'border-zinc-500/50 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
};

const CORE_TASK_TYPES = new Set<TaskRow['task_type']>(['chore', 'cleanup', 'docs', 'research']);
const MARKETING_TASK_PATTERN =
  /\b(marketing|landing-page hook|tweet|linkedin|reddit|founder launch|screenshot shot list|demo script|before-after proof|social post|reel|tiktok|instagram|youtube)\b/i;

function isMarketingTask(task: TaskRow): boolean {
  return MARKETING_TASK_PATTERN.test(`${task.title ?? ''}\n${task.description ?? ''}`);
}

function getProductLane(task: TaskRow): ProductLane {
  if (CORE_TASK_TYPES.has(task.task_type)) return 'Core';
  if (task.priority === 'high') return 'P0';
  if (task.priority === 'medium') return 'P1';
  return 'P2';
}

type BlockerResolutionId = 'approve' | 'config' | 'keep_blocked' | 'not_needed';

interface BlockerResolutionOption {
  id: BlockerResolutionId;
  label: string;
  description: string;
  resolvesBlocker: boolean;
  marksDone: boolean;
  body: (task: TaskRow) => string;
}

const DEFAULT_ACCEPTANCE_BY_PROJECT: Record<string, string[]> = {
  'saas-maker': [
    'pnpm --filter ./apps/cockpit typecheck',
    'pnpm vitest run tests/droid/runs.test.ts',
    'pnpm test',
  ],
};

function formatDroidComments(comments: TaskCommentRow[]) {
  return comments
    .slice(-8)
    .map((comment) =>
      [
        `- ${comment.author_type} at ${comment.created_at}:`,
        comment.body.trim().slice(0, 1200),
      ].join(' ')
    )
    .join('\n');
}

function buildDroidPrompt(
  task: TaskRow,
  options: {
    acceptanceCommand?: string;
    comments?: TaskCommentRow[];
    repoUrl?: string;
    branch?: string;
  } = {}
): string {
  const commentBlock = options.comments?.length ? formatDroidComments(options.comments) : '';
  const doneCommand = buildSymphonyDoneCommand(task);
  return [
    'You own this task end to end. Make the smallest complete code change, verify it, and prepare a draft PR when useful.',
    '',
    `Task: ${task.title}`,
    `Task ID: ${task.id}`,
    `Project: ${task.project_slug ?? 'unassigned'}`,
    options.repoUrl ? `Repo: ${options.repoUrl}` : '',
    options.branch ? `Branch: ${options.branch}` : '',
    task.description ? `\nDetails:\n${task.description}` : '',
    commentBlock ? `\nRecent task comments:\n${commentBlock}` : '',
    options.acceptanceCommand
      ? `\nAcceptance command to run before PR:\n${options.acceptanceCommand}`
      : '',
    `\nAfter verification, mark this task done with:\n${doneCommand}`,
    '',
    'When blocked, return a block action only for a concrete user decision or missing config, with the exact question. When done, summarize changed files, checks run, risks, and next action.',
  ]
    .filter(Boolean)
    .join('\n');
}

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

function blockerResolutionOptions(): BlockerResolutionOption[] {
  return [
    {
      id: 'approve',
      label: 'Approve and unblock',
      description: 'The agent can proceed using the task as written.',
      resolvesBlocker: true,
      marksDone: false,
      body: (task) =>
        [
          'Approved and unblocked.',
          '',
          `Proceed with ${task.project_slug ? `${formatProjectLabel(task.project_slug)} ` : ''}task "${task.title}" using the existing acceptance criteria and repo conventions.`,
        ].join('\n'),
    },
    {
      id: 'config',
      label: 'Config/access is ready',
      description:
        'Required token, account, deploy config, or external setting has been provided outside the task.',
      resolvesBlocker: true,
      marksDone: false,
      body: (task) =>
        [
          'Required config/access is ready.',
          '',
          `Proceed with "${task.title}" and verify against the task acceptance criteria without exposing secrets in logs or comments.`,
        ].join('\n'),
    },
    {
      id: 'keep_blocked',
      label: 'Keep blocked',
      description: 'Add the missing decision/config instructions and move to the next blocker.',
      resolvesBlocker: false,
      marksDone: false,
      body: (task) =>
        [
          'Keep this task blocked.',
          '',
          `The blocker for "${task.title}" still needs external action or a decision before an agent should proceed.`,
        ].join('\n'),
    },
    {
      id: 'not_needed',
      label: 'No longer needed',
      description: 'Close this task as done because it no longer needs action.',
      resolvesBlocker: false,
      marksDone: true,
      body: (task) =>
        [
          'No longer needed.',
          '',
          `Closing "${task.title}" because the requested work is no longer required or has already been handled elsewhere.`,
        ].join('\n'),
    },
  ];
}

function buildBlockerComment(task: TaskRow, option: BlockerResolutionOption, instructions: string) {
  const trimmed = instructions.trim();
  return [option.body(task), trimmed ? `Additional instructions:\n${trimmed}` : '']
    .filter(Boolean)
    .join('\n\n');
}

function buildDroidAcceptanceSuggestions(task: TaskRow): {
  explicit?: string;
  suggestions: string[];
} {
  const explicit = extractAcceptanceCommand(task.description);
  const projectCommands = task.project_slug
    ? (DEFAULT_ACCEPTANCE_BY_PROJECT[task.project_slug] ?? [])
    : [];
  const suggestions = uniqueStrings([
    explicit,
    ...projectCommands,
    'pnpm test',
    'pnpm typecheck',
  ]).slice(0, 4);

  return { explicit, suggestions };
}

function extractAcceptanceCommand(description: string | null): string | undefined {
  if (!description) return undefined;
  const fenced = description.match(/Acceptance command:\s*`([^`]+)`/i)?.[1]?.trim();
  if (fenced) return fenced;
  const line = description.match(/Acceptance command:\s*([^\n]+)/i)?.[1]?.trim();
  return line || undefined;
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

function formatRunTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(time).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function TaskBoard({
  initialTasks,
  initialRuns,
  projectSlugs,
  projectRepos,
  initialMemory,
  isLocal,
}: {
  initialTasks: TaskRow[];
  initialRuns?: SymphonyRunRow[];
  projectSlugs: string[];
  projectRepos?: Record<string, string>;
  initialMemory: string;
  isLocal: boolean;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [runs, setRuns] = useState<SymphonyRunRow[]>(initialRuns ?? []);
  const [memory, setMemory] = useState(initialMemory);
  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [runTask, setRunTask] = useState<TaskRow | null>(null);
  const [runInstructions, setRunInstructions] = useState('');
  const [droidTask, setDroidTask] = useState<TaskRow | null>(null);
  const [droidMode, setDroidMode] = useState<DroidMode>('native');
  const [droidCommand, setDroidCommand] = useState('pwd && ls -1');
  const [droidPrompt, setDroidPrompt] = useState('');
  const [droidMaxTurns, setDroidMaxTurns] = useState('25');
  const [droidLoopEnabled, setDroidLoopEnabled] = useState(true);
  const [droidLoopMaxAttempts, setDroidLoopMaxAttempts] = useState('2');
  const [droidLoopRetryOnFailure, setDroidLoopRetryOnFailure] = useState(true);
  const [droidCreatePr, setDroidCreatePr] = useState(true);
  const [droidAcceptanceCommand, setDroidAcceptanceCommand] = useState('');
  const [droidAcceptanceSuggestions, setDroidAcceptanceSuggestions] = useState<string[]>([]);
  const [droidBrowserAcceptanceEnabled, setDroidBrowserAcceptanceEnabled] = useState(false);
  const [droidBrowserAcceptanceUrl, setDroidBrowserAcceptanceUrl] = useState('');
  const [droidBrowserAcceptanceGoal, setDroidBrowserAcceptanceGoal] = useState('');
  const [droidBrowserAcceptanceAssertText, setDroidBrowserAcceptanceAssertText] = useState('');
  const [droidBrowserAcceptanceStartCommand, setDroidBrowserAcceptanceStartCommand] = useState('');
  const [droidBrowserAcceptancePort, setDroidBrowserAcceptancePort] = useState('3000');
  const [droidBrowserAcceptanceKeepOpen, setDroidBrowserAcceptanceKeepOpen] = useState(true);
  const [droidRepoUrl, setDroidRepoUrl] = useState('');
  const [droidBranch, setDroidBranch] = useState('');
  const [droidCwd, setDroidCwd] = useState('');
  const [startingDroidRun, setStartingDroidRun] = useState(false);
  const [loadingDroidLogsTaskId, setLoadingDroidLogsTaskId] = useState<string | null>(null);
  const [droidRun, setDroidRun] = useState<DroidRunRow | null>(null);
  const [droidEvents, setDroidEvents] = useState<DroidRunEvent[]>([]);
  const [droidArtifacts, setDroidArtifacts] = useState<DroidRunArtifact[]>([]);
  const [droidStats, setDroidStats] = useState<DroidRunStats | null>(null);
  const [droidError, setDroidError] = useState<string | null>(null);
  const [commentTask, setCommentTask] = useState<TaskRow | null>(null);
  const [commentsByTaskId, setCommentsByTaskId] = useState<Record<string, TaskCommentRow[]>>({});
  const [commentText, setCommentText] = useState('');
  const [resolveWithComment, setResolveWithComment] = useState(true);
  const [markDoneWithComment, setMarkDoneWithComment] = useState(false);
  const [syncCommentToDescription, setSyncCommentToDescription] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [blockerFlowOpen, setBlockerFlowOpen] = useState(false);
  const [blockerIndex, setBlockerIndex] = useState(0);
  const [blockerSolution, setBlockerSolution] = useState<BlockerResolutionId>('approve');
  const [blockerInstructions, setBlockerInstructions] = useState('');
  const [loadingBlockerComments, setLoadingBlockerComments] = useState(false);
  const [savingBlockerResolution, setSavingBlockerResolution] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const [form, setForm] = useState<TaskFormData>(EMPTY_FORM);
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [agentUsage, setAgentUsage] = useState<SymphonyAgentUsageSnapshot | null>(null);
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [priorityFilter, setPriorityFilter] = useState(ALL_PRIORITIES);
  const [laneFilter, setLaneFilter] = useState<typeof ALL_LANES | ProductLane>(ALL_LANES);
  const [workstreamFilter, setWorkstreamFilter] = useState<WorkstreamFilter>(ALL_WORKSTREAMS);
  const [showDone, setShowDone] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const allProjectSlugs = sortProjectSlugs(
    Array.from(
      new Set([
        ...projectSlugs,
        ...tasks.map((task) => task.project_slug).filter((slug): slug is string => Boolean(slug)),
      ])
    )
  );

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const latestRunByTaskId = new Map<string, SymphonyRunRow>();
  for (const run of runs) {
    if (run.task_id && !latestRunByTaskId.has(run.task_id)) {
      latestRunByTaskId.set(run.task_id, run);
    }
  }

  const filteredTasks = sortTasksByPriority(
    tasks.filter((task) => {
      const matchesProject =
        projectFilter === ALL_PROJECTS ||
        (projectFilter === UNASSIGNED_PROJECT
          ? !task.project_slug
          : task.project_slug === projectFilter);
      const matchesPriority = priorityFilter === ALL_PRIORITIES || task.priority === priorityFilter;
      const matchesLane = laneFilter === ALL_LANES || getProductLane(task) === laneFilter;
      const matchesWorkstream =
        workstreamFilter === ALL_WORKSTREAMS ||
        (workstreamFilter === 'marketing' ? isMarketingTask(task) : !isMarketingTask(task));
      const matchesStatus = showDone || task.status !== 'done';
      return matchesProject && matchesPriority && matchesLane && matchesWorkstream && matchesStatus;
    })
  ).sort((a, b) => Number(isTaskBlocked(a, tasksById)) - Number(isTaskBlocked(b, tasksById)));

  const selectedTasks = selectedTaskIds
    .map((id) => tasksById.get(id))
    .filter((task): task is TaskRow => Boolean(task));

  const runnableSelectedTasks = selectedTasks.filter(
    (task) => task.status === 'todo' && !isTaskBlocked(task, tasksById)
  );
  const visibleRunnableTasks = filteredTasks.filter(
    (task) => task.status === 'todo' && !isTaskBlocked(task, tasksById)
  );
  const blockedUserTasks = sortTasksByPriority(
    tasks.filter((task) => task.status !== 'done' && task.blocked_on_user)
  );
  const visibleStatusTasks = tasks.filter((task) => showDone || task.status !== 'done');
  const marketingTaskCount = visibleStatusTasks.filter(isMarketingTask).length;
  const productWorkTaskCount = visibleStatusTasks.length - marketingTaskCount;
  const productFilteredTasks = filteredTasks.filter((task) => !isMarketingTask(task));
  const marketingFilteredTasks = filteredTasks.filter(isMarketingTask);
  const currentBlockerTask = blockedUserTasks[blockerIndex] ?? null;
  const currentBlockerComments = currentBlockerTask
    ? (commentsByTaskId[currentBlockerTask.id] ?? [])
    : [];
  const resolutionOptions = blockerResolutionOptions();
  const selectedBlockerOption =
    resolutionOptions.find((option) => option.id === blockerSolution) ?? resolutionOptions[0]!;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadCommentsForTask = useCallback(
    async (taskId: string, setLoadingState?: (loading: boolean) => void) => {
      if (commentsByTaskId[taskId]) return commentsByTaskId[taskId];
      setLoadingState?.(true);
      try {
        const res = await taskBoardFetch<{ data: TaskCommentRow[] }>(
          `/v1/tasks/${taskId}/comments`,
          isLocal
        );
        const comments = res.data ?? [];
        setCommentsByTaskId((prev) => ({ ...prev, [taskId]: comments }));
        return comments;
      } catch {
        showToast('Failed to load comments');
        return [];
      } finally {
        setLoadingState?.(false);
      }
    },
    [commentsByTaskId, showToast, isLocal]
  );

  const openBlockerFlow = () => {
    if (blockedUserTasks.length === 0) {
      showToast('No decision blockers');
      return;
    }
    setBlockerIndex(0);
    setBlockerSolution('approve');
    setBlockerInstructions('');
    setBlockerFlowOpen(true);
  };

  useEffect(() => {
    if (!blockerFlowOpen || !currentBlockerTask) return;
    setBlockerSolution('approve');
    setBlockerInstructions('');
    void loadCommentsForTask(currentBlockerTask.id, setLoadingBlockerComments);
  }, [blockerFlowOpen, currentBlockerTask?.id, loadCommentsForTask, currentBlockerTask]);

  const openCreate = () => {
    setEditTask(null);
    setForm(EMPTY_FORM);
    setRelationshipSearch('');
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
      branch_name: task.branch_name ?? '',
      pr_url: task.pr_url ?? '',
      pr_status: task.pr_status ?? 'none',
      commit_sha: task.commit_sha ?? '',
      deployment_url: task.deployment_url ?? '',
      deployment_status: task.deployment_status ?? 'none',
      blocked_on_user: task.blocked_on_user,
      dependencies: getDependencies(task),
    });
    setRelationshipSearch('');
    setModalOpen(true);
  };

  const openRun = (task: TaskRow) => {
    setRunTask(task);
    setRunInstructions('');
  };

  const openDroidRun = (task: TaskRow) => {
    const acceptance = buildDroidAcceptanceSuggestions(task);
    const repoUrl = task.project_slug ? (projectRepos?.[task.project_slug] ?? '') : '';
    const branch = task.branch_name ?? '';
    setDroidTask(task);
    setDroidMode('native');
    setDroidCommand(task.project_slug ? 'pwd && ls -1' : 'pwd && echo droid-ok');
    setDroidPrompt(
      buildDroidPrompt(task, {
        acceptanceCommand: acceptance.explicit,
        comments: commentsByTaskId[task.id],
        repoUrl,
        branch,
      })
    );
    setDroidMaxTurns('25');
    setDroidLoopEnabled(true);
    setDroidLoopMaxAttempts('2');
    setDroidLoopRetryOnFailure(true);
    setDroidCreatePr(true);
    setDroidAcceptanceSuggestions(acceptance.suggestions);
    setDroidAcceptanceCommand(acceptance.explicit ?? '');
    setDroidBrowserAcceptanceEnabled(false);
    setDroidBrowserAcceptanceUrl('');
    setDroidBrowserAcceptanceGoal(`Verify ${task.title}`);
    setDroidBrowserAcceptanceAssertText('');
    setDroidBrowserAcceptanceStartCommand('');
    setDroidBrowserAcceptancePort('3000');
    setDroidBrowserAcceptanceKeepOpen(true);
    setDroidRepoUrl(repoUrl);
    setDroidBranch(branch);
    setDroidCwd('');
    setDroidRun(null);
    setDroidEvents([]);
    setDroidArtifacts([]);
    setDroidStats(null);
    setDroidError(null);
    void loadDroidStats(task.project_slug);
  };

  const loadDroidRunDetails = useCallback(async (runId: string) => {
    const runRes = await fetch(`/api/droid/runs/${runId}`);
    const runPayload = (await runRes.json()) as { data?: DroidRunRow };
    if (runPayload.data) setDroidRun(runPayload.data);
    const eventsRes = await fetch(`/api/droid/runs/${runId}/events`);
    const eventsPayload = (await eventsRes.json()) as { data?: DroidRunEvent[] };
    setDroidEvents(eventsPayload.data ?? []);
    const artifactsRes = await fetch(`/api/droid/runs/${runId}/artifacts`);
    const artifactsPayload = (await artifactsRes.json()) as { data?: DroidRunArtifact[] };
    setDroidArtifacts(artifactsPayload.data ?? []);
  }, []);

  const loadDroidStats = useCallback(async (projectSlug?: string | null) => {
    const params = new URLSearchParams({ limit: '4' });
    if (projectSlug) params.set('project_slug', projectSlug);
    const statsRes = await fetch(`/api/droid/stats?${params.toString()}`);
    const statsPayload = (await statsRes.json()) as { data?: DroidRunStats };
    setDroidStats(statsPayload.data ?? null);
  }, []);

  useEffect(() => {
    if (!droidRun || (droidRun.status !== 'queued' && droidRun.status !== 'running')) return;
    const interval = window.setInterval(() => {
      void loadDroidRunDetails(droidRun.id);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [droidRun, loadDroidRunDetails]);

  const openDroidLogs = async (task: TaskRow) => {
    const acceptance = buildDroidAcceptanceSuggestions(task);
    const repoUrl = task.project_slug ? (projectRepos?.[task.project_slug] ?? '') : '';
    const branch = task.branch_name ?? '';
    let comments = commentsByTaskId[task.id] ?? [];
    if (!commentsByTaskId[task.id]) {
      try {
        const res = await taskBoardFetch<{ data: TaskCommentRow[] }>(
          `/v1/tasks/${task.id}/comments`,
          isLocal
        );
        comments = res.data ?? [];
        setCommentsByTaskId((prev) => ({ ...prev, [task.id]: comments }));
      } catch {
        comments = [];
      }
    }
    setLoadingDroidLogsTaskId(task.id);
    setDroidTask(task);
    setDroidMode('native');
    setDroidCommand(task.project_slug ? 'pwd && ls -1' : 'pwd && echo droid-ok');
    setDroidPrompt(
      buildDroidPrompt(task, {
        acceptanceCommand: acceptance.explicit,
        comments,
        repoUrl,
        branch,
      })
    );
    setDroidMaxTurns('25');
    setDroidLoopEnabled(true);
    setDroidLoopMaxAttempts('2');
    setDroidLoopRetryOnFailure(true);
    setDroidCreatePr(true);
    setDroidAcceptanceSuggestions(acceptance.suggestions);
    setDroidAcceptanceCommand(acceptance.explicit ?? '');
    setDroidBrowserAcceptanceEnabled(false);
    setDroidBrowserAcceptanceUrl('');
    setDroidBrowserAcceptanceGoal(`Verify ${task.title}`);
    setDroidBrowserAcceptanceAssertText('');
    setDroidBrowserAcceptanceStartCommand('');
    setDroidBrowserAcceptancePort('3000');
    setDroidBrowserAcceptanceKeepOpen(true);
    setDroidRepoUrl(repoUrl);
    setDroidBranch(branch);
    setDroidCwd('');
    setDroidRun(null);
    setDroidEvents([]);
    setDroidArtifacts([]);
    setDroidStats(null);
    setDroidError(null);
    void loadDroidStats(task.project_slug);
    try {
      const runsRes = await fetch(`/api/droid/runs?task_id=${encodeURIComponent(task.id)}&limit=1`);
      const runsPayload = (await runsRes.json()) as { data?: DroidRunRow[]; error?: string };
      if (!runsRes.ok) throw new Error(runsPayload.error || 'Failed to load Droid runs');
      const latestRun = runsPayload.data?.[0];
      if (!latestRun) {
        showToast('No Droid logs for this task yet');
        return;
      }
      setDroidRun(latestRun);
      await loadDroidRunDetails(latestRun.id);
    } catch (error) {
      showToast(
        error instanceof Error ? `Logs failed: ${error.message.slice(0, 120)}` : 'Logs failed'
      );
    } finally {
      setLoadingDroidLogsTaskId(null);
    }
  };

  const toggleTaskSelection = (task: TaskRow, selected: boolean) => {
    if (task.status !== 'todo' || isTaskBlocked(task, tasksById)) return;
    setSelectedTaskIds((prev) => {
      if (selected) return prev.includes(task.id) ? prev : [...prev, task.id];
      return prev.filter((id) => id !== task.id);
    });
  };

  const selectVisibleRunnableTasks = () => {
    setSelectedTaskIds(visibleRunnableTasks.map((task) => task.id));
  };

  const clearSelectedTasks = () => {
    setSelectedTaskIds([]);
  };

  const openComments = async (task: TaskRow) => {
    setCommentTask(task);
    setCommentText('');
    setResolveWithComment(task.blocked_on_user);
    setMarkDoneWithComment(false);
    setSyncCommentToDescription(task.blocked_on_user);
    await loadCommentsForTask(task.id, setLoadingComments);
  };

  const handleAddComment = async () => {
    if (!commentTask || !commentText.trim()) return;
    const resolvesBlocker = Boolean(commentTask.blocked_on_user && resolveWithComment);
    const marksDone = Boolean(commentTask.status !== 'done' && markDoneWithComment);
    setSavingComment(true);
    try {
      const res = await taskBoardFetch<{ data: TaskCommentRow; task?: TaskRow | null }>(
        `/v1/tasks/${commentTask.id}/comments`,
        isLocal,
        {
          method: 'POST',
          body: JSON.stringify({
            body: commentText.trim(),
            resolves_blocker: resolvesBlocker,
            marks_done: marksDone,
            sync_to_description: syncCommentToDescription,
          }),
        }
      );
      setCommentsByTaskId((prev) => ({
        ...prev,
        [commentTask.id]: [...(prev[commentTask.id] ?? []), res.data],
      }));
      if (res.task) {
        setTasks((prev) => prev.map((task) => (task.id === res.task!.id ? res.task! : task)));
        setCommentTask(res.task);
      } else if (resolvesBlocker || marksDone) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === commentTask.id
              ? {
                  ...task,
                  status: marksDone ? 'done' : task.status,
                  blocked_on_user: false,
                  updated_at: new Date().toISOString(),
                }
              : task
          )
        );
        setCommentTask((prev) =>
          prev
            ? {
                ...prev,
                status: marksDone ? 'done' : prev.status,
                blocked_on_user: false,
                updated_at: new Date().toISOString(),
              }
            : prev
        );
      }
      if (resolvesBlocker) {
        setResolveWithComment(false);
      }
      if (marksDone) {
        setMarkDoneWithComment(false);
      }
      if (syncCommentToDescription) {
        setSyncCommentToDescription(false);
      }
      setCommentText('');
      showToast(
        marksDone
          ? 'Comment added and task marked done'
          : resolvesBlocker
            ? 'Comment added and blocker resolved'
            : 'Comment added'
      );
    } catch {
      showToast('Failed to add comment');
    } finally {
      setSavingComment(false);
    }
  };

  const advanceBlockerFlow = (resolvedCurrent: boolean) => {
    if (!resolvedCurrent) {
      if (blockerIndex < blockedUserTasks.length - 1) {
        setBlockerIndex((prev) => prev + 1);
      } else {
        setBlockerFlowOpen(false);
      }
      return;
    }

    const remainingCount = Math.max(blockedUserTasks.length - 1, 0);
    if (remainingCount === 0) {
      setBlockerFlowOpen(false);
      return;
    }
    setBlockerIndex((prev) => Math.min(prev, remainingCount - 1));
  };

  const handleBlockerResolution = async () => {
    if (!currentBlockerTask || !selectedBlockerOption) return;
    const body = buildBlockerComment(
      currentBlockerTask,
      selectedBlockerOption,
      blockerInstructions
    );
    setSavingBlockerResolution(true);
    try {
      const res = await taskBoardFetch<{ data: TaskCommentRow; task?: TaskRow | null }>(
        `/v1/tasks/${currentBlockerTask.id}/comments`,
        isLocal,
        {
          method: 'POST',
          body: JSON.stringify({
            body,
            resolves_blocker: selectedBlockerOption.resolvesBlocker,
            marks_done: selectedBlockerOption.marksDone,
            sync_to_description: true,
          }),
        }
      );
      setCommentsByTaskId((prev) => ({
        ...prev,
        [currentBlockerTask.id]: [...(prev[currentBlockerTask.id] ?? []), res.data],
      }));
      if (res.task) {
        setTasks((prev) => prev.map((task) => (task.id === res.task!.id ? res.task! : task)));
      } else if (selectedBlockerOption.resolvesBlocker || selectedBlockerOption.marksDone) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === currentBlockerTask.id
              ? {
                  ...task,
                  status: selectedBlockerOption.marksDone ? 'done' : task.status,
                  blocked_on_user: false,
                  updated_at: new Date().toISOString(),
                }
              : task
          )
        );
      }
      showToast(
        selectedBlockerOption.marksDone
          ? 'Task closed'
          : selectedBlockerOption.resolvesBlocker
            ? 'Blocker resolved'
            : 'Blocker note saved'
      );
      advanceBlockerFlow(selectedBlockerOption.resolvesBlocker || selectedBlockerOption.marksDone);
    } catch {
      showToast('Failed to resolve blocker');
    } finally {
      setSavingBlockerResolution(false);
    }
  };

  const relationshipQuery = relationshipSearch.trim().toLowerCase();
  const relationshipCandidates = sortTasksByPriority(
    tasks.filter(
      (task) =>
        task.id !== editTask?.id &&
        task.status !== 'done' &&
        (!form.project_slug || !task.project_slug || task.project_slug === form.project_slug)
    )
  );
  const visibleRelationshipCandidates = relationshipCandidates
    .filter((task) => {
      if (!relationshipQuery) return true;
      return [
        task.title,
        task.description ?? '',
        task.project_slug ?? '',
        PRIORITY_LABEL[task.priority],
        STATUS_LABEL[task.status],
      ]
        .join(' ')
        .toLowerCase()
        .includes(relationshipQuery);
    })
    .slice(0, 40);

  const toggleDependency = (taskId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      dependencies: checked
        ? Array.from(new Set([...prev.dependencies, taskId]))
        : prev.dependencies.filter((id) => id !== taskId),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editTask) {
        const res = await taskBoardFetch<{ data: TaskRow }>(`/v1/tasks/${editTask.id}`, isLocal, {
          method: 'PATCH',
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description || undefined,
            project_slug: form.project_slug || undefined,
            priority: form.priority,
            task_type: form.task_type,
            branch_name: form.branch_name || null,
            pr_url: form.pr_url || null,
            pr_status: form.pr_status,
            commit_sha: form.commit_sha || null,
            deployment_url: form.deployment_url || null,
            deployment_status: form.deployment_status,
            blocked_on_user: form.blocked_on_user,
            dependencies: form.dependencies,
          }),
        });
        setTasks((prev) => prev.map((t) => (t.id === editTask.id ? res.data : t)));
        showToast('Task updated');
      } else {
        const res = await taskBoardFetch<{ data: TaskRow }>('/v1/tasks', isLocal, {
          method: 'POST',
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description || undefined,
            project_slug: form.project_slug || undefined,
            priority: form.priority,
            task_type: form.task_type,
            branch_name: form.branch_name || null,
            pr_url: form.pr_url || null,
            pr_status: form.pr_status,
            commit_sha: form.commit_sha || null,
            deployment_url: form.deployment_url || null,
            deployment_status: form.deployment_status,
            blocked_on_user: form.blocked_on_user,
            dependencies: form.dependencies,
          }),
        });
        setTasks((prev) => [res.data, ...prev]);
        showToast('Task created');
      }
      setModalOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error
          ? `Failed to save task: ${error.message.slice(0, 120)}`
          : 'Failed to save task'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: TaskRow) => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await taskBoardFetch(`/v1/tasks/${task.id}`, isLocal, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      showToast('Task deleted');
    } catch {
      showToast('Failed to delete task');
    }
  };

  const handleStatusChange = async (task: TaskRow, newStatus: TaskRow['status']) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await taskBoardFetch(`/v1/tasks/${task.id}`, isLocal, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
      showToast('Failed to update status');
    }
  };

  const handlePriorityChange = async (task: TaskRow, newPriority: TaskRow['priority']) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority: newPriority } : t)));
    try {
      await taskBoardFetch(`/v1/tasks/${task.id}`, isLocal, {
        method: 'PATCH',
        body: JSON.stringify({ priority: newPriority }),
      });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, priority: task.priority } : t))
      );
      showToast('Failed to update priority');
    }
  };

  const handleTypeChange = async (task: TaskRow, newType: TaskRow['task_type']) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, task_type: newType } : t)));
    try {
      await taskBoardFetch(`/v1/tasks/${task.id}`, isLocal, {
        method: 'PATCH',
        body: JSON.stringify({ task_type: newType }),
      });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, task_type: task.task_type } : t))
      );
      showToast('Failed to update type');
    }
  };

  const handleMemorySave = async () => {
    setSavingMemory(true);
    try {
      await taskBoardFetch('/v1/symphony/memory', isLocal, {
        method: 'PUT',
        body: JSON.stringify({ content: memory }),
      });
      showToast('Memory saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to save memory: ${message.slice(0, 120)}`);
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDispatch = async (task: TaskRow, additionalInstructions = '') => {
    if (isTaskBlocked(task, tasksById)) {
      showToast('Task is blocked by unfinished prerequisites');
      return;
    }
    setStartingRun(true);
    if (!isLocal) {
      try {
        await navigator.clipboard.writeText(
          buildSymphonyPrompt(task, memory, additionalInstructions)
        );
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
      const result = (await res.json()) as {
        route?: { agent?: string; label?: string };
        runs?: Array<{ taskId: string; pid?: number; route?: { agent?: string } }>;
      };
      showToast(`${result.route?.label ?? 'Agent'} started`);
      const started = result.runs?.find((run) => run.taskId === task.id);
      setRuns((prev) => [
        {
          ...buildSymphonyRunRecord(task, {
            agent: started?.route?.agent ?? result.route?.agent,
            memory,
            additionalInstructions,
            agentUsage,
            pid: started?.pid,
            terminalHint: 'cockpit local run',
          }),
          started_at: new Date().toISOString(),
        },
        ...prev,
      ]);
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

  const handleDroidRun = async () => {
    if (!droidTask) return;
    if (droidMode === 'command' && !droidCommand.trim()) return;
    if (droidMode !== 'command' && !droidPrompt.trim()) return;
    if (
      droidBrowserAcceptanceEnabled &&
      !droidBrowserAcceptanceUrl.trim() &&
      !droidBrowserAcceptanceStartCommand.trim()
    ) {
      showToast('Add a browser test URL or start command');
      return;
    }
    setStartingDroidRun(true);
    setDroidRun(null);
    setDroidEvents([]);
    setDroidArtifacts([]);
    setDroidStats(null);
    setDroidError(null);
    try {
      const res = await fetch('/api/droid/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: droidTask,
          mode: droidMode,
          command: droidMode === 'command' ? droidCommand.trim() : undefined,
          prompt: droidMode !== 'command' ? droidPrompt.trim() : undefined,
          max_turns: droidMode === 'native' ? Number(droidMaxTurns) : undefined,
          timeout_seconds: droidMode !== 'command' ? 900 : undefined,
          loop_policy:
            droidMode === 'native' && droidLoopEnabled
              ? {
                  enabled: true,
                  max_attempts: Number(droidLoopMaxAttempts),
                  retry_on_failure: droidLoopRetryOnFailure,
                  stop_on_blocker: true,
                }
              : undefined,
          create_pr: droidCreatePr,
          pr_title: droidTask ? `Droid: ${droidTask.title}` : undefined,
          acceptance_command: droidAcceptanceCommand.trim() || undefined,
          browser_acceptance: droidBrowserAcceptanceEnabled
            ? {
                enabled: true,
                goal: droidBrowserAcceptanceGoal.trim() || undefined,
                url: droidBrowserAcceptanceUrl.trim() || undefined,
                start_command: droidBrowserAcceptanceStartCommand.trim() || undefined,
                port: Number(droidBrowserAcceptancePort) || undefined,
                assert_text: droidBrowserAcceptanceAssertText
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
                keep_open: droidBrowserAcceptanceKeepOpen,
                timeout_seconds: 120,
              }
            : undefined,
          repo_url: droidRepoUrl.trim() || undefined,
          branch: droidBranch.trim() || undefined,
          cwd: droidCwd.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as { data?: DroidRunRow; error?: string };
      if (!res.ok || !payload.data) throw new Error(payload.error || 'Droid run failed');
      setDroidRun(payload.data);
      await loadDroidRunDetails(payload.data.id);
      await loadDroidStats(droidTask.project_slug);
      showToast(`Droid ${payload.data.status}`);
      if (droidTask.status === 'todo') {
        await handleStatusChange(droidTask, 'in_progress');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Droid failed';
      setDroidError(message);
      showToast(`Droid failed: ${message.slice(0, 120)}`);
    } finally {
      setStartingDroidRun(false);
    }
  };

  const handleDroidReconcile = async () => {
    if (!droidRun) return;
    setStartingDroidRun(true);
    setDroidError(null);
    try {
      const res = await fetch(`/api/droid/runs/${droidRun.id}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await res.json()) as { data?: DroidRunRow; error?: string };
      if (!res.ok || !payload.data) throw new Error(payload.error || 'Droid reconcile failed');
      setDroidRun(payload.data);
      await loadDroidRunDetails(payload.data.id);
      await loadDroidStats(payload.data.project_slug);
      showToast('Droid reconcile queued');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reconcile failed';
      setDroidError(message);
      showToast(`Reconcile failed: ${message.slice(0, 120)}`);
    } finally {
      setStartingDroidRun(false);
    }
  };

  const handleDroidCancel = async () => {
    if (!droidRun) return;
    setStartingDroidRun(true);
    setDroidError(null);
    try {
      const res = await fetch(`/api/droid/runs/${droidRun.id}/cancel`, {
        method: 'POST',
      });
      const payload = (await res.json()) as { data?: DroidRunRow; error?: string };
      if (!res.ok || !payload.data) throw new Error(payload.error || 'Droid cancel failed');
      setDroidRun(payload.data);
      await loadDroidRunDetails(payload.data.id);
      await loadDroidStats(payload.data.project_slug);
      showToast('Droid run cancelled');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Droid cancel failed';
      setDroidError(message);
      showToast(`Cancel failed: ${message.slice(0, 120)}`);
    } finally {
      setStartingDroidRun(false);
    }
  };

  const handleDroidMarkStale = async () => {
    if (!droidRun) return;
    setStartingDroidRun(true);
    setDroidError(null);
    try {
      const res = await fetch(`/api/droid/runs/${droidRun.id}/mark-stale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wait_for_dispatch: true }),
      });
      const payload = (await res.json()) as { data?: DroidRunRow; error?: string };
      if (!res.ok || !payload.data) throw new Error(payload.error || 'Droid stale recovery failed');
      setDroidRun(payload.data);
      await loadDroidRunDetails(payload.data.id);
      await loadDroidStats(payload.data.project_slug);
      showToast('Droid stale run released');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Droid stale recovery failed';
      setDroidError(message);
      showToast(`Stale recovery failed: ${message.slice(0, 120)}`);
    } finally {
      setStartingDroidRun(false);
    }
  };

  const handleBatchDispatch = async () => {
    if (runnableSelectedTasks.length === 0) {
      showToast('Select runnable todo tasks first');
      return;
    }
    if (runnableSelectedTasks.length !== selectedTasks.length) {
      showToast('Blocked or non-todo tasks were skipped');
    }

    setStartingRun(true);
    if (!isLocal) {
      try {
        await navigator.clipboard.writeText(
          buildSymphonyBatchPrompt(runnableSelectedTasks, { memory })
        );
        showToast(`${runnableSelectedTasks.length} prompts copied`);
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
        body: JSON.stringify({ tasks: runnableSelectedTasks, memory }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = (await res.json()) as {
        runs?: Array<{ taskId: string; pid?: number; route?: { agent?: string; label?: string } }>;
      };
      const labels = Array.from(
        new Set((result.runs ?? []).map((run) => run.route?.label).filter(Boolean))
      );
      showToast(
        `${runnableSelectedTasks.length} ${runnableSelectedTasks.length === 1 ? 'agent' : 'agents'} started${labels.length ? `: ${labels.join(', ')}` : ''}`
      );
      setRuns((prev) => [
        ...runnableSelectedTasks.map((task) => {
          const started = result.runs?.find((run) => run.taskId === task.id);
          return {
            ...buildSymphonyRunRecord(task, {
              agent: started?.route?.agent,
              memory,
              agentUsage,
              pid: started?.pid,
              terminalHint: 'cockpit batch local run',
            }),
            started_at: new Date().toISOString(),
          };
        }),
        ...prev,
      ]);
      setTasks((prev) =>
        prev.map((task) =>
          runnableSelectedTasks.some((selected) => selected.id === task.id)
            ? { ...task, status: 'in_progress' }
            : task
        )
      );
      setSelectedTaskIds([]);
    } catch {
      showToast('Failed to start selected agents');
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

  useEffect(() => {
    if (!isLocal) return;
    let cancelled = false;
    fetch('/api/tasks/agent-usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: { data?: SymphonyAgentUsageSnapshot | null } | null) => {
        if (!cancelled) setAgentUsage(payload?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgentUsage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isLocal]);

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label
                htmlFor="project-filter"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Project
              </Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger id="project-filter" className="h-9 w-[min(20rem,calc(100vw-2rem))]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                  <SelectItem value={UNASSIGNED_PROJECT}>Unassigned</SelectItem>
                  {allProjectSlugs.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {formatProjectLabel(slug)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="priority-filter"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
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
            <div className="space-y-1">
              <Label
                htmlFor="workstream-filter"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Workstream
              </Label>
              <Select
                value={workstreamFilter}
                onValueChange={(value) => setWorkstreamFilter(value as WorkstreamFilter)}
              >
                <SelectTrigger id="workstream-filter" className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_WORKSTREAMS}>All work</SelectItem>
                  <SelectItem value="product">Product work ({productWorkTaskCount})</SelectItem>
                  <SelectItem value="marketing">Marketing ({marketingTaskCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="lane-filter"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Product lane
              </Label>
              <Select
                value={laneFilter}
                onValueChange={(value) => setLaneFilter(value as typeof ALL_LANES | ProductLane)}
              >
                <SelectTrigger id="lane-filter" className="h-9 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LANES}>All lanes</SelectItem>
                  {PRODUCT_LANE_ORDER.map((lane) => (
                    <SelectItem key={lane} value={lane}>
                      {PRODUCT_LANE_LABEL[lane]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {filteredTasks.length} / {tasks.length} tasks
            </Badge>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by workstream"
            >
              {[
                { value: 'product' as const, label: 'Product work', count: productWorkTaskCount },
                { value: 'marketing' as const, label: 'Marketing', count: marketingTaskCount },
              ].map((item) => {
                const active = workstreamFilter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setWorkstreamFilter((prev) =>
                        prev === item.value ? ALL_WORKSTREAMS : item.value
                      )
                    }
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-[10px] uppercase tracking-wider transition',
                      item.value === 'marketing'
                        ? 'border-pink-500/45 bg-pink-500/10 text-pink-600 dark:text-pink-300'
                        : 'border-emerald-500/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
                      active ? 'ring-1 ring-foreground/40' : 'opacity-80 hover:opacity-100'
                    )}
                    aria-pressed={active}
                  >
                    <span>{item.label}</span>
                    <span className="rounded-full bg-background/40 px-1.5 text-[10px] font-semibold">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by product lane"
            >
              {PRODUCT_LANE_ORDER.map((lane) => {
                const count = tasks.filter(
                  (task) =>
                    (showDone || task.status !== 'done') &&
                    (workstreamFilter === ALL_WORKSTREAMS ||
                      (workstreamFilter === 'marketing'
                        ? isMarketingTask(task)
                        : !isMarketingTask(task))) &&
                    getProductLane(task) === lane
                ).length;
                const active = laneFilter === lane;
                return (
                  <button
                    key={lane}
                    type="button"
                    onClick={() => setLaneFilter((prev) => (prev === lane ? ALL_LANES : lane))}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-mono text-[10px] uppercase tracking-wider transition',
                      PRODUCT_LANE_BADGE[lane],
                      active ? 'ring-1 ring-foreground/40' : 'opacity-80 hover:opacity-100'
                    )}
                    aria-pressed={active}
                  >
                    <span>{lane}</span>
                    <span className="rounded-full bg-background/40 px-1.5 text-[10px] font-semibold">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDone((prev) => !prev)}
              className="h-9"
            >
              {showDone ? 'Hide done' : 'Show done'}
            </Button>
          </div>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Tasks sort by priority first, then latest update. Production tasks are shared across the
            dashboard, pnpm symphony, and whichever local agent command you dispatch.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button
              type="button"
              variant={blockedUserTasks.length > 0 ? 'default' : 'outline'}
              size="sm"
              onClick={openBlockerFlow}
              disabled={blockedUserTasks.length === 0}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Resolve blockers
              {blockedUserTasks.length > 0 ? (
                <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-xs">
                  {blockedUserTasks.length}
                </span>
              ) : null}
            </Button>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Task
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {runnableSelectedTasks.length} runnable selected
          </div>
          <p className="text-xs text-muted-foreground">
            Batch dispatch keeps routing per task and skips blocked or completed work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectVisibleRunnableTasks}
            disabled={visibleRunnableTasks.length === 0}
          >
            Select runnable
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelectedTasks}
            disabled={selectedTaskIds.length === 0}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleBatchDispatch}
            disabled={startingRun || runnableSelectedTasks.length === 0}
          >
            <Bot className="h-4 w-4" />
            {startingRun ? 'Starting...' : isLocal ? 'Start Selected' : 'Copy Selected'}
          </Button>
        </div>
      </div>

      {workstreamFilter === ALL_WORKSTREAMS ? (
        <div className="space-y-4">
          <TaskListSection title="Product Work" count={productFilteredTasks.length} tone="product">
            <TaskList
              tasks={productFilteredTasks}
              tasksById={tasksById}
              selectedTaskIds={selectedTaskIds}
              onSelectionChange={toggleTaskSelection}
              onEdit={openEdit}
              onDelete={handleDelete}
              onComments={openComments}
              onRun={handleDispatch}
              onCustomizeRun={openRun}
              onDroidRun={openDroidRun}
              onDroidLogs={openDroidLogs}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onTypeChange={handleTypeChange}
              latestRunByTaskId={latestRunByTaskId}
              loadingDroidLogsTaskId={loadingDroidLogsTaskId}
              isLocal={isLocal}
              emptyMessage="No product tasks match these filters."
            />
          </TaskListSection>
          <TaskListSection title="Marketing" count={marketingFilteredTasks.length} tone="marketing">
            <TaskList
              tasks={marketingFilteredTasks}
              tasksById={tasksById}
              selectedTaskIds={selectedTaskIds}
              onSelectionChange={toggleTaskSelection}
              onEdit={openEdit}
              onDelete={handleDelete}
              onComments={openComments}
              onRun={handleDispatch}
              onCustomizeRun={openRun}
              onDroidRun={openDroidRun}
              onDroidLogs={openDroidLogs}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onTypeChange={handleTypeChange}
              latestRunByTaskId={latestRunByTaskId}
              loadingDroidLogsTaskId={loadingDroidLogsTaskId}
              isLocal={isLocal}
              emptyMessage="No marketing tasks match these filters."
            />
          </TaskListSection>
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          tasksById={tasksById}
          selectedTaskIds={selectedTaskIds}
          onSelectionChange={toggleTaskSelection}
          onEdit={openEdit}
          onDelete={handleDelete}
          onComments={openComments}
          onRun={handleDispatch}
          onCustomizeRun={openRun}
          onDroidRun={openDroidRun}
          onDroidLogs={openDroidLogs}
          onStatusChange={handleStatusChange}
          onPriorityChange={handlePriorityChange}
          onTypeChange={handleTypeChange}
          latestRunByTaskId={latestRunByTaskId}
          loadingDroidLogsTaskId={loadingDroidLogsTaskId}
          isLocal={isLocal}
          emptyMessage="No tasks match this project filter."
        />
      )}

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Symphony Memory</h2>
            <p className="text-xs text-muted-foreground">
              Shared instructions that get injected into every copied prompt and local run.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleMemorySave}
            disabled={savingMemory}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {savingMemory ? 'Saving...' : 'Save Memory'}
          </Button>
        </div>
        <Textarea
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
          rows={7}
          className="max-h-64 min-h-32 resize-y font-mono text-xs"
          placeholder="Persistent operating preferences for Symphony agents..."
        />
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[min(68rem,calc(100vw-1rem))] max-h-[calc(100vh-1rem)] overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader>
            <div className="border-b px-5 py-4">
              <DialogTitle>{editTask ? 'Edit Task' : 'New Task'}</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Write the task like a Linear issue: clear outcome first, metadata second.
              </p>
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex max-h-[calc(100vh-6rem)] flex-col">
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="space-y-5 px-5 py-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="title"
                    className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
                  >
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="What needs to happen?"
                    required
                    autoFocus
                    className="h-12 rounded-lg bg-background px-3 text-lg font-semibold shadow-none"
                  />
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {form.project_slug ? formatProjectLabel(form.project_slug) : 'No project'}
                    </Badge>
                    <Badge variant="outline">
                      {PRIORITY_LABEL[form.priority as TaskRow['priority']] ?? form.priority}
                    </Badge>
                    <Badge variant="outline">
                      {TASK_TYPE_LABEL[form.task_type as TaskRow['task_type']] ?? form.task_type}
                    </Badge>
                    {form.blocked_on_user ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                      >
                        Needs decision
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="description"
                    className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="What should change? Why now? What proves it is done?"
                    rows={11}
                    className="min-h-80 resize-y bg-background text-sm leading-6 shadow-none"
                  />
                </div>
              </div>

              <aside className="space-y-4 border-t bg-muted/10 px-5 py-4 lg:border-l lg:border-t-0">
                <div className="space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Properties
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="space-y-1.5">
                      <Label>Project</Label>
                      <Select
                        value={form.project_slug}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, project_slug: v === '__none__' ? '' : v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {sortProjectSlugs(projectSlugs).map((slug) => (
                            <SelectItem key={slug} value={slug}>
                              {formatProjectLabel(slug)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Priority</Label>
                      <Select
                        value={form.priority}
                        onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
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
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select
                        value={form.task_type}
                        onValueChange={(v) => setForm((f) => ({ ...f, task_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-background/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label htmlFor="blocked-on-user">Needs decision</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Use this only for missing approval, config, or product direction.
                      </p>
                    </div>
                    <Switch
                      id="blocked-on-user"
                      checked={form.blocked_on_user}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({
                          ...f,
                          blocked_on_user: checked,
                          deployment_status: checked ? 'none' : f.deployment_status,
                        }))
                      }
                    />
                  </div>
                </div>

                <details className="group rounded-lg border bg-background/50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground">
                    <span>Dependencies</span>
                    <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      {form.dependencies.length > 0
                        ? `${form.dependencies.length} selected`
                        : 'Optional'}
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="border-t px-3 py-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Only add a blocker when this task cannot run until another task is done.
                    </p>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={relationshipSearch}
                        onChange={(event) => setRelationshipSearch(event.target.value)}
                        placeholder="Search related tasks..."
                        className="h-9 pl-9"
                      />
                    </div>
                  </div>
                  {relationshipCandidates.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border-t">
                      {visibleRelationshipCandidates.map((candidate) => {
                        const selected = form.dependencies.includes(candidate.id);
                        return (
                          <label
                            key={candidate.id}
                            className={cn(
                              'flex cursor-pointer items-start gap-2 border-b px-3 py-2 text-xs last:border-b-0 hover:bg-muted/30',
                              selected && 'bg-primary/5'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                toggleDependency(candidate.id, event.target.checked)
                              }
                              className="mt-0.5 h-4 w-4 rounded border-border text-primary"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-1 font-medium text-foreground">
                                {candidate.title}
                              </span>
                              <span className="mt-0.5 block truncate text-muted-foreground">
                                {formatProjectLabel(candidate.project_slug)} ·{' '}
                                {PRIORITY_LABEL[candidate.priority]} ·{' '}
                                {STATUS_LABEL[candidate.status]}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                      {visibleRelationshipCandidates.length === 0 ? (
                        <div className="px-3 py-5 text-center text-xs text-muted-foreground">
                          No tasks match “{relationshipSearch.trim()}”.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="border-t px-3 py-5 text-center text-xs text-muted-foreground">
                      No open tasks match this project.
                    </p>
                  )}
                </details>

                <div className="space-y-3">
                  <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Lifecycle
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="branch-name">Branch</Label>
                      <Input
                        id="branch-name"
                        value={form.branch_name}
                        onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))}
                        placeholder="codex/task-lifecycle"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="commit-sha">Commit</Label>
                      <Input
                        id="commit-sha"
                        value={form.commit_sha}
                        onChange={(e) => setForm((f) => ({ ...f, commit_sha: e.target.value }))}
                        placeholder="abcdef1"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pr-url">PR URL</Label>
                      <Input
                        id="pr-url"
                        value={form.pr_url}
                        onChange={(e) => setForm((f) => ({ ...f, pr_url: e.target.value }))}
                        placeholder="https://github.com/org/repo/pull/123"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>PR Status</Label>
                      <Select
                        value={form.pr_status}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, pr_status: v as TaskRow['pr_status'] }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PR_STATUS_LABEL).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="deployment-url">Deployment URL</Label>
                      <Input
                        id="deployment-url"
                        value={form.deployment_url}
                        onChange={(e) => setForm((f) => ({ ...f, deployment_url: e.target.value }))}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Deployment</Label>
                      <Select
                        value={form.deployment_status}
                        onValueChange={(v) =>
                          setForm((f) => ({
                            ...f,
                            deployment_status: v as TaskRow['deployment_status'],
                            blocked_on_user: v === 'none' ? f.blocked_on_user : false,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(DEPLOYMENT_STATUS_LABEL).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
            <div className="flex justify-end gap-2 border-t bg-background px-5 py-3">
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

      <Dialog
        open={!!runTask}
        onOpenChange={(open) => {
          if (!open) {
            setRunTask(null);
            setRunInstructions('');
          }
        }}
      >
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
                      {chooseSymphonyAgent(runTask, memory, runInstructions, agentUsage).label}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Auto from task + usage cache
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {chooseSymphonyAgent(runTask, memory, runInstructions, agentUsage).reason}
                </p>
                {chooseSymphonyAgent(runTask, memory, runInstructions, agentUsage).budgetNote ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {chooseSymphonyAgent(runTask, memory, runInstructions, agentUsage).budgetNote}
                  </p>
                ) : null}
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
                  onChange={(e) => setRunInstructions(e.target.value)}
                  rows={5}
                  className="min-h-28 resize-y"
                  placeholder="Add one-off guidance for this run..."
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRunTask(null);
                    setRunInstructions('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" variant="secondary" onClick={copyRunPrompt}>
                  <Clipboard className="h-4 w-4" />
                  Copy Prompt
                </Button>
                <Button
                  type="button"
                  onClick={() => handleDispatch(runTask, runInstructions)}
                  disabled={startingRun}
                >
                  <Bot className="h-4 w-4" />
                  {startingRun ? 'Starting...' : isLocal ? 'Start Run' : 'Copy Prompt'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DroidDialog
        task={droidTask}
        mode={droidMode}
        command={droidCommand}
        prompt={droidPrompt}
        maxTurns={droidMaxTurns}
        loopEnabled={droidLoopEnabled}
        loopMaxAttempts={droidLoopMaxAttempts}
        loopRetryOnFailure={droidLoopRetryOnFailure}
        createPr={droidCreatePr}
        acceptanceCommand={droidAcceptanceCommand}
        acceptanceSuggestions={droidAcceptanceSuggestions}
        browserAcceptanceEnabled={droidBrowserAcceptanceEnabled}
        browserAcceptanceUrl={droidBrowserAcceptanceUrl}
        browserAcceptanceGoal={droidBrowserAcceptanceGoal}
        browserAcceptanceAssertText={droidBrowserAcceptanceAssertText}
        browserAcceptanceStartCommand={droidBrowserAcceptanceStartCommand}
        browserAcceptancePort={droidBrowserAcceptancePort}
        browserAcceptanceKeepOpen={droidBrowserAcceptanceKeepOpen}
        repoUrl={droidRepoUrl}
        branch={droidBranch}
        cwd={droidCwd}
        run={droidRun}
        events={droidEvents}
        artifacts={droidArtifacts}
        stats={droidStats}
        error={droidError}
        running={startingDroidRun}
        onModeChange={setDroidMode}
        onCommandChange={setDroidCommand}
        onPromptChange={setDroidPrompt}
        onMaxTurnsChange={setDroidMaxTurns}
        onLoopEnabledChange={setDroidLoopEnabled}
        onLoopMaxAttemptsChange={setDroidLoopMaxAttempts}
        onLoopRetryOnFailureChange={setDroidLoopRetryOnFailure}
        onCreatePrChange={setDroidCreatePr}
        onAcceptanceCommandChange={setDroidAcceptanceCommand}
        onBrowserAcceptanceEnabledChange={setDroidBrowserAcceptanceEnabled}
        onBrowserAcceptanceUrlChange={setDroidBrowserAcceptanceUrl}
        onBrowserAcceptanceGoalChange={setDroidBrowserAcceptanceGoal}
        onBrowserAcceptanceAssertTextChange={setDroidBrowserAcceptanceAssertText}
        onBrowserAcceptanceStartCommandChange={setDroidBrowserAcceptanceStartCommand}
        onBrowserAcceptancePortChange={setDroidBrowserAcceptancePort}
        onBrowserAcceptanceKeepOpenChange={setDroidBrowserAcceptanceKeepOpen}
        onRepoUrlChange={setDroidRepoUrl}
        onBranchChange={setDroidBranch}
        onCwdChange={setDroidCwd}
        onRun={handleDroidRun}
        onReconcile={handleDroidReconcile}
        onCancel={handleDroidCancel}
        onMarkStale={handleDroidMarkStale}
        onClose={() => {
          setDroidTask(null);
          setDroidMode('native');
          setDroidCommand('pwd && ls -1');
          setDroidPrompt('');
          setDroidMaxTurns('25');
          setDroidLoopEnabled(true);
          setDroidLoopMaxAttempts('2');
          setDroidLoopRetryOnFailure(true);
          setDroidCreatePr(true);
          setDroidAcceptanceCommand('');
          setDroidBrowserAcceptanceEnabled(false);
          setDroidBrowserAcceptanceUrl('');
          setDroidBrowserAcceptanceGoal('');
          setDroidBrowserAcceptanceAssertText('');
          setDroidBrowserAcceptanceStartCommand('');
          setDroidBrowserAcceptancePort('3000');
          setDroidBrowserAcceptanceKeepOpen(true);
          setDroidRepoUrl('');
          setDroidBranch('');
          setDroidCwd('');
          setDroidRun(null);
          setDroidEvents([]);
          setDroidArtifacts([]);
          setDroidStats(null);
          setDroidError(null);
        }}
      />

      <Dialog
        open={blockerFlowOpen}
        onOpenChange={(open) => {
          setBlockerFlowOpen(open);
          if (!open) {
            setBlockerIndex(0);
            setBlockerSolution('approve');
            setBlockerInstructions('');
          }
        }}
      >
        <DialogContent className="w-[min(68rem,calc(100vw-2rem))] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Resolve Blockers</DialogTitle>
          </DialogHeader>
          {currentBlockerTask ? (
            <div className="mt-2 grid max-h-[calc(100vh-9rem)] gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/25 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Blocker {Math.min(blockerIndex + 1, blockedUserTasks.length)} of{' '}
                        {blockedUserTasks.length}
                      </div>
                      <h2 className="mt-1 text-base font-semibold text-foreground">
                        {currentBlockerTask.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                        <Badge variant="outline">
                          {formatProjectLabel(currentBlockerTask.project_slug)}
                        </Badge>
                        <Badge variant="outline">
                          {PRIORITY_LABEL[currentBlockerTask.priority]}
                        </Badge>
                        <Badge variant="outline">
                          {TASK_TYPE_LABEL[currentBlockerTask.task_type]}
                        </Badge>
                        <Badge variant="outline">{STATUS_LABEL[currentBlockerTask.status]}</Badge>
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                        >
                          Needs decision
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setBlockerIndex((index) => Math.max(index - 1, 0))}
                        disabled={blockerIndex === 0 || savingBlockerResolution}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setBlockerIndex((index) =>
                            Math.min(index + 1, blockedUserTasks.length - 1)
                          )
                        }
                        disabled={
                          blockerIndex >= blockedUserTasks.length - 1 || savingBlockerResolution
                        }
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {currentBlockerTask.branch_name ? (
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Branch
                      </div>
                      <div className="mt-1 break-all font-mono text-xs text-foreground">
                        {currentBlockerTask.branch_name}
                      </div>
                    </div>
                  ) : null}
                  {currentBlockerTask.commit_sha ? (
                    <div className="rounded-lg border bg-background p-3">
                      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Commit
                      </div>
                      <div className="mt-1 break-all font-mono text-xs text-foreground">
                        {currentBlockerTask.commit_sha}
                      </div>
                    </div>
                  ) : null}
                  {currentBlockerTask.pr_url ? (
                    <a
                      href={currentBlockerTask.pr_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border bg-background p-3 text-sm hover:bg-muted/30"
                    >
                      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Pull Request
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-foreground">
                        Open PR <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </a>
                  ) : null}
                  {currentBlockerTask.deployment_url ? (
                    <a
                      href={currentBlockerTask.deployment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border bg-background p-3 text-sm hover:bg-muted/30"
                    >
                      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Deployment
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-foreground">
                        Open deploy <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </a>
                  ) : null}
                  {currentBlockerTask.project_slug &&
                  projectRepos?.[currentBlockerTask.project_slug] ? (
                    <a
                      href={projectRepos[currentBlockerTask.project_slug]}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border bg-background p-3 text-sm hover:bg-muted/30"
                    >
                      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Repository
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 text-foreground">
                        {projectRepos[currentBlockerTask.project_slug]}{' '}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </div>
                    </a>
                  ) : null}
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Task details
                  </div>
                  <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/25 p-3 text-xs leading-5 text-foreground [overflow-wrap:anywhere]">
                    {currentBlockerTask.description || 'No description provided.'}
                  </pre>
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Recent comments
                    </div>
                    {loadingBlockerComments ? (
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    ) : null}
                  </div>
                  <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                    {currentBlockerComments.length === 0 && !loadingBlockerComments ? (
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    ) : (
                      currentBlockerComments.slice(-8).map((comment) => (
                        <div
                          key={comment.id}
                          className="min-w-0 overflow-hidden rounded-md border bg-muted/15 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {comment.author_type === 'agent' ? 'Agent' : 'You'}
                            </span>
                            <span>{formatRunTime(comment.created_at)}</span>
                            {comment.resolves_blocker ? (
                              <span className="text-emerald-600 dark:text-emerald-300">
                                resolved blocker
                              </span>
                            ) : null}
                            {comment.marks_done ? (
                              <span className="text-emerald-600 dark:text-emerald-300">
                                marked done
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-foreground [overflow-wrap:anywhere]">
                            {comment.body}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-3">
                  <div className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Suggested solutions
                  </div>
                  <div className="space-y-2">
                    {resolutionOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBlockerSolution(option.id)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition-colors',
                          blockerSolution === option.id
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'bg-background hover:bg-muted/35'
                        )}
                      >
                        <div className="text-sm font-medium">{option.label}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <Label htmlFor="blocker-instructions">Further instructions</Label>
                  <Textarea
                    id="blocker-instructions"
                    value={blockerInstructions}
                    onChange={(event) => setBlockerInstructions(event.target.value)}
                    rows={8}
                    className="mt-2 min-h-40 resize-y"
                    placeholder="Add the concrete decision, credential status, Cloudflare setting, OAuth redirect, approval scope, or anything the next agent needs..."
                  />
                  <div className="mt-3 rounded-md border bg-background p-2">
                    <div className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Comment preview
                    </div>
                    <pre className="max-h-48 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                      {buildBlockerComment(
                        currentBlockerTask,
                        selectedBlockerOption,
                        blockerInstructions
                      )}
                    </pre>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBlockerFlowOpen(false)}
                    disabled={savingBlockerResolution}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={handleBlockerResolution}
                    disabled={savingBlockerResolution}
                  >
                    <MessageSquare className="h-4 w-4" />
                    {savingBlockerResolution
                      ? 'Saving...'
                      : selectedBlockerOption?.id === 'keep_blocked'
                        ? 'Save and next'
                        : blockerIndex >= blockedUserTasks.length - 1
                          ? 'Apply'
                          : 'Apply and next'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No decision blockers left.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!commentTask}
        onOpenChange={(open) => {
          if (!open) {
            setCommentTask(null);
            setCommentText('');
            setResolveWithComment(true);
            setMarkDoneWithComment(false);
            setSyncCommentToDescription(true);
          }
        }}
      >
        <DialogContent className="w-[min(44rem,calc(100vw-2rem))] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Comments</DialogTitle>
          </DialogHeader>
          {commentTask && (
            <div className="mt-2 space-y-4">
              <div className="rounded-lg border bg-muted/25 p-3">
                <div className="text-sm font-medium text-foreground">{commentTask.title}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>{formatProjectLabel(commentTask.project_slug)}</span>
                  {commentTask.blocked_on_user ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                    >
                      Needs decision
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border bg-background p-3">
                {loadingComments ? (
                  <p className="text-sm text-muted-foreground">Loading comments...</p>
                ) : (commentsByTaskId[commentTask.id]?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                ) : (
                  commentsByTaskId[commentTask.id]?.map((comment) => (
                    <div
                      key={comment.id}
                      className="min-w-0 overflow-hidden rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {comment.author_type === 'agent' ? 'Agent' : 'You'}
                        </span>
                        <span>{formatRunTime(comment.created_at)}</span>
                        {comment.resolves_blocker ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            resolved blocker
                          </span>
                        ) : null}
                        {comment.marks_done ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            marked done
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
                        {comment.body}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-comment">Add comment</Label>
                <Textarea
                  id="task-comment"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  rows={4}
                  className="min-h-24 resize-y"
                  placeholder="Add context, answer a blocker, or leave a note for the next agent..."
                />
                {commentTask.blocked_on_user ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={resolveWithComment}
                      onChange={(event) => setResolveWithComment(event.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    Resolve decision blocker with this comment
                  </label>
                ) : null}
                {commentTask.status !== 'done' ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={markDoneWithComment}
                      onChange={(event) => setMarkDoneWithComment(event.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    Mark task done with this comment
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={syncCommentToDescription}
                    onChange={(event) => setSyncCommentToDescription(event.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary"
                  />
                  Add this comment to the task description
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCommentTask(null)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={handleAddComment}
                  disabled={savingComment || !commentText.trim()}
                >
                  <MessageSquare className="h-4 w-4" />
                  {savingComment ? 'Adding...' : 'Add Comment'}
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

function TaskListSection({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: 'product' | 'marketing';
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              tone === 'marketing' ? 'bg-pink-500' : 'bg-emerald-500'
            )}
          />
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {count}
        </Badge>
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function TaskList({
  tasks,
  tasksById,
  selectedTaskIds,
  onSelectionChange,
  onEdit,
  onDelete,
  onComments,
  onRun,
  onCustomizeRun,
  onDroidRun,
  onDroidLogs,
  onStatusChange,
  onPriorityChange,
  onTypeChange,
  latestRunByTaskId,
  loadingDroidLogsTaskId,
  isLocal,
  emptyMessage,
}: {
  tasks: TaskRow[];
  tasksById: Map<string, TaskRow>;
  selectedTaskIds: string[];
  onSelectionChange: (t: TaskRow, selected: boolean) => void;
  onEdit: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
  onComments: (t: TaskRow) => void;
  onRun: (t: TaskRow) => void;
  onCustomizeRun: (t: TaskRow) => void;
  onDroidRun: (t: TaskRow) => void;
  onDroidLogs: (t: TaskRow) => void;
  onStatusChange: (t: TaskRow, s: TaskRow['status']) => void;
  onPriorityChange: (t: TaskRow, p: TaskRow['priority']) => void;
  onTypeChange: (t: TaskRow, p: TaskRow['task_type']) => void;
  latestRunByTaskId: Map<string, SymphonyRunRow>;
  loadingDroidLogsTaskId: string | null;
  isLocal: boolean;
  emptyMessage: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/35">
      {tasks.map((task) => {
        const preview = taskPreview(task.description);
        const blocked = isTaskBlocked(task, tasksById);
        const dependencyBlocked = getDependencies(task).some((id) => {
          const prereq = tasksById.get(id);
          return prereq?.status !== 'done';
        });
        const dependencyTasks = getDependencies(task)
          .map((id) => tasksById.get(id))
          .filter((candidate): candidate is TaskRow => Boolean(candidate));
        const latestRun = latestRunByTaskId.get(task.id);
        const metadataPillClass =
          'inline-flex h-7 items-center rounded-full border border-border/60 bg-background/35 px-3 text-xs font-normal text-muted-foreground shadow-none';
        const metadataSelectClass = cn(
          metadataPillClass,
          'cursor-pointer appearance-none py-0 pr-7 hover:border-border hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35'
        );
        return (
          <article
            key={task.id}
            className="group grid min-h-[5rem] grid-cols-[2rem_2.25rem_minmax(0,1fr)_auto] items-center gap-0 px-2 py-3 transition-colors hover:bg-muted/20 max-sm:grid-cols-[2rem_2rem_minmax(0,1fr)]"
          >
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={selectedTaskIds.includes(task.id)}
                disabled={task.status !== 'todo' || blocked}
                onChange={(event) => onSelectionChange(task, event.target.checked)}
                aria-label={`Select ${task.title} for batch dispatch`}
                title={
                  blocked
                    ? 'Blocked by unfinished prerequisites'
                    : task.status !== 'todo'
                      ? 'Only todo tasks can be batch dispatched'
                      : 'Select for batch dispatch'
                }
                className="h-4 w-4 rounded border-border text-primary disabled:cursor-not-allowed disabled:opacity-35"
              />
            </div>
            <div className="flex items-center justify-center">
              <span
                className={cn('h-4 w-4 rounded-full border-2', STATUS_DOT_CLASS[task.status])}
                title={STATUS_LABEL[task.status]}
              />
            </div>
            <div className="min-w-0 px-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <h3 className="truncate text-base font-medium leading-6 text-foreground">
                  <Link href={`/tasks/${task.id}`} className="hover:underline">
                    {task.title}
                  </Link>
                </h3>
                {task.blocked_on_user && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 bg-amber-500/10 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-300"
                    title="Waiting for a concrete decision or missing config"
                  >
                    Needs decision
                  </Badge>
                )}
                {dependencyBlocked && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 bg-amber-500/10 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-300"
                    title={`Blocked by: ${getDependencies(task).join(', ')}`}
                  >
                    Blocked
                  </Badge>
                )}
              </div>
              {preview && (
                <p className="max-w-2xl truncate text-sm leading-5 text-muted-foreground">
                  {preview}
                </p>
              )}
              {dependencyTasks.length > 0 && (
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground/80">Blocked by</span>
                  {dependencyTasks.slice(0, 3).map((dependency) => (
                    <Link
                      key={dependency.id}
                      href={`/tasks/${dependency.id}`}
                      className={cn(
                        'inline-flex max-w-56 items-center gap-1 truncate rounded-full border px-2 py-0.5 hover:border-border hover:text-foreground',
                        dependency.status === 'done'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                      )}
                    >
                      <span className="truncate">{dependency.title}</span>
                    </Link>
                  ))}
                  {dependencyTasks.length > 3 ? (
                    <span>+{dependencyTasks.length - 3} more</span>
                  ) : null}
                </div>
              )}
              <div className="mt-1 flex min-w-0 items-center gap-1 max-sm:hidden">
                <span
                  className={cn(
                    metadataPillClass,
                    'max-w-32 hover:border-border hover:bg-background/70'
                  )}
                >
                  <span className="truncate">{formatProjectLabel(task.project_slug)}</span>
                </span>
                <span className="relative inline-flex">
                  <select
                    value={task.task_type}
                    onChange={(event) =>
                      onTypeChange(task, event.target.value as TaskRow['task_type'])
                    }
                    className={cn(metadataSelectClass, 'w-[5.75rem]')}
                    aria-label={`Type for ${task.title}`}
                  >
                    {Object.entries(TASK_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground opacity-35" />
                </span>
                <span className="relative inline-flex">
                  <span
                    className={cn(
                      'pointer-events-none absolute left-3 top-1/2 z-10 h-2 w-2 -translate-y-1/2 rounded-full',
                      PRIORITY_DOT[task.priority]
                    )}
                  />
                  <select
                    value={task.priority}
                    onChange={(event) =>
                      onPriorityChange(task, event.target.value as TaskRow['priority'])
                    }
                    className={cn(metadataSelectClass, 'w-[5.25rem] pl-7')}
                    aria-label={`Priority for ${task.title}`}
                  >
                    {(['high', 'medium', 'low'] as const).map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABEL[priority]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground opacity-35" />
                </span>
              </div>
              {(task.status === 'done' ||
                task.branch_name ||
                task.pr_url ||
                task.commit_sha ||
                task.deployment_url ||
                task.pr_status !== 'none' ||
                task.deployment_status !== 'none') && (
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] leading-5 text-muted-foreground">
                  {task.branch_name ? (
                    <span className="inline-flex max-w-48 items-center gap-1 truncate rounded-full border border-border/60 bg-background/35 px-2 py-0.5 font-mono">
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <span className="truncate">{task.branch_name}</span>
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5',
                      LIFECYCLE_BADGE_CLASS[task.pr_status]
                    )}
                  >
                    {PR_STATUS_LABEL[task.pr_status]}
                  </span>
                  {task.pr_url ? (
                    <>
                      <a
                        href={task.pr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/35 px-2 py-0.5 text-foreground/80 hover:border-border hover:text-foreground"
                      >
                        PR <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={`codevetter://review?url=${encodeURIComponent(task.pr_url)}&taskId=${task.id}&project=${task.project_slug ?? ''}`}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 hover:border-emerald-500/60 dark:text-emerald-300"
                        title="Open in CodeVetter for AI review"
                      >
                        AI Review <Play className="h-3 w-3" />
                      </a>
                    </>
                  ) : null}
                  {task.commit_sha ? (
                    <span className="rounded-full border border-border/60 bg-background/35 px-2 py-0.5 font-mono">
                      {task.commit_sha.slice(0, 7)}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5',
                      LIFECYCLE_BADGE_CLASS[task.deployment_status]
                    )}
                  >
                    {DEPLOYMENT_STATUS_LABEL[task.deployment_status]}
                  </span>
                  {task.deployment_url ? (
                    <a
                      href={task.deployment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/35 px-2 py-0.5 text-foreground/80 hover:border-border hover:text-foreground"
                    >
                      Deploy <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {task.status === 'done' &&
                    (task.has_changelog ? (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-300">
                        changelog
                      </span>
                    ) : task.task_type === 'feature' || task.task_type === 'bug' ? (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-300">
                        no changelog
                      </span>
                    ) : null)}
                </div>
              )}
              {latestRun && (
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-[11px] leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground/80">Last run</span>
                  <span>{formatRunTime(latestRun.started_at)}</span>
                  <span>via {latestRun.agent_profile ?? latestRun.command_template}</span>
                  {latestRun.pid ? <span>pid {latestRun.pid}</span> : null}
                  {latestRun.cost_note ? (
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5',
                        latestRun.cost_note.includes('high-cost')
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      )}
                    >
                      {latestRun.cost_note}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex min-w-0 items-center justify-end gap-1 max-sm:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDroidLogs(task)}
                disabled={loadingDroidLogsTaskId === task.id}
                title="View Droid audit logs"
                className="h-8 rounded-full px-3 text-sm text-muted-foreground opacity-80 hover:text-foreground hover:opacity-100 disabled:cursor-wait disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5" />
                {loadingDroidLogsTaskId === task.id ? 'Loading' : 'Logs'}
              </Button>
              {task.status !== 'done' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDroidRun(task)}
                  disabled={blocked}
                  title={
                    blocked
                      ? 'Blocked by unfinished prerequisites'
                      : 'Run a command in a Cloudflare Droid sandbox'
                  }
                  className="h-8 rounded-full px-3 text-sm text-muted-foreground opacity-80 hover:text-foreground hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Droid
                </Button>
              )}
              {task.status === 'todo' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRun(task)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (!blocked) onCustomizeRun(task);
                  }}
                  disabled={blocked}
                  title={
                    blocked
                      ? 'Blocked by unfinished prerequisites'
                      : 'Right-click to customize instructions before running'
                  }
                  className="h-8 rounded-full px-3 text-sm text-muted-foreground opacity-80 hover:text-foreground hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                onClick={() => onEdit(task)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
                onClick={() => onComments(task)}
                title="Comments"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
