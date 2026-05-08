/**
 * Pure helpers that build Symphony audit event payloads.
 *
 * Kept separate from the CLI orchestrator so the dispatch/pick metadata
 * can be unit tested without spawning child processes or hitting the API.
 */

const HIGH_COST_AGENT_HINTS = ['opus', 'gpt-4', 'claude-3.7', 'claude-4', 'pro'];

export const RUN_AUDIT_ACTION = 'task_run_started';
export const DISPATCH_AUDIT_ACTION = 'task_dispatched';
export const PICK_AUDIT_ACTION = 'task_picked';

function commandTemplateLabel(agent, agentCommand) {
  if (agentCommand && typeof agentCommand === 'string' && agentCommand.trim()) {
    return 'custom';
  }
  return agent || 'codex';
}

export function detectCostHint(agent, template) {
  const haystack = `${agent ?? ''} ${template ?? ''}`.toLowerCase();
  return HIGH_COST_AGENT_HINTS.some((hint) => haystack.includes(hint))
    ? 'high-cost profile requested - verify task explicitly needs it'
    : 'cheap-default route';
}

function workspacePathForTask(task) {
  return `.symphony/workspaces/${task.id.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export function buildRunAuditEvent({
  task,
  action,
  actorSource,
  agent,
  agentCommand,
  route,
  pid,
  note,
  extra,
} = {}) {
  if (!task?.id) throw new Error('Symphony audit event needs a task with id');
  if (!action) throw new Error('Symphony audit event needs an action');

  const template = commandTemplateLabel(agent, agentCommand);
  const costNote = detectCostHint(agent, agentCommand || template);

  const metadata = {
    command_template: template,
    agent: agent ?? null,
    route_label: route?.label ?? null,
    route_reason: route?.reason ?? null,
    priority: task.priority ?? null,
    task_type: task.task_type ?? null,
    cost_note: costNote,
    pid: typeof pid === 'number' && Number.isFinite(pid) ? pid : null,
  };
  if (note) metadata.note = String(note);
  if (extra && typeof extra === 'object') Object.assign(metadata, extra);

  return {
    task_id: task.id,
    action,
    actor_source: actorSource ?? 'local-cli',
    agent_profile: agent ?? null,
    project_slug: task.project_slug ?? null,
    metadata,
  };
}

export function buildRunLedgerRecord({
  task,
  agent,
  agentCommand,
  route,
  pid,
  terminalHint,
  logHint,
  tokenNote,
  extra,
} = {}) {
  if (!task?.id) throw new Error('Symphony run ledger record needs a task with id');

  const workspacePath = workspacePathForTask(task);
  const template = commandTemplateLabel(agent, agentCommand);
  const resolvedAgent = agent ?? route?.agent ?? null;
  const costNote = detectCostHint(resolvedAgent, agentCommand || template);

  return {
    task_id: task.id,
    project_slug: task.project_slug ?? null,
    agent_profile: resolvedAgent,
    model_profile: resolvedAgent,
    command_template: template,
    pid: typeof pid === 'number' && Number.isFinite(pid) ? pid : null,
    status: 'started',
    workspace_path: workspacePath,
    prompt_path: `${workspacePath}/prompt.md`,
    terminal_hint: terminalHint ?? 'local shell command',
    log_hint: logHint ?? null,
    cost_note: costNote,
    token_note: tokenNote ?? null,
    metadata: {
      route_label: route?.label ?? null,
      route_reason: route?.reason ?? null,
      priority: task.priority ?? null,
      task_type: task.task_type ?? null,
      ...(extra && typeof extra === 'object' ? extra : {}),
    },
  };
}
