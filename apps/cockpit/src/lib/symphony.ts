export type SymphonyTask = {
  id: string;
  title: string;
  description: string | null;
  project_slug: string | null;
  priority: string;
  task_type?: string;
  status: string;
  branch_name?: string | null;
  pr_url?: string | null;
  pr_status?: string | null;
  commit_sha?: string | null;
  deployment_url?: string | null;
  deployment_status?: string | null;
};

type SymphonyAgentOptions = {
  agent?: string;
  agentCommand?: string;
  memory?: string;
  additionalInstructions?: string;
};

export type SymphonyAgent = "codex" | "claude" | "gemini";

export type SymphonyRoute = {
  agent: SymphonyAgent;
  label: string;
  reason: string;
};

export type SymphonyRunSpec = {
  taskId: string;
  route: SymphonyRoute;
  prompt: string;
  command: string;
};

const AGENT_COMMANDS: Record<string, string> = {
  codex: "codex exec --dangerously-bypass-approvals-and-sandbox {prompt}",
  claude: "claude --dangerously-skip-permissions -p {prompt}",
  gemini: "gemini --yolo -p {prompt}",
};

const AGENT_LABELS: Record<SymphonyAgent, string> = {
  codex: "Codex",
  claude: "Claude",
  gemini: "Gemini",
};

const HIGH_COST_AGENT_HINTS = ["opus", "gpt-4", "claude-3.7", "claude-4", "pro"];

export const DEFAULT_SYMPHONY_MEMORY = `Symphony behavior and routing policy:
- Treat the task row as the source of truth.
- Use the task project, priority, type, and custom run instructions when deciding how to execute.
- Prefer the cheapest capable route: Codex for implementation-heavy work, bugs, tests, and high-priority tasks; Gemini for broad research/docs synthesis; Claude only when cleanup, chore, deep refactor, architecture, or careful prose-heavy changes justify it.
- Avoid high-cost model/profile names such as Opus, Pro, GPT-4, Claude 3.7, or Claude 4 unless the task explicitly asks for that capability.
- Explicit run instructions or memory preferences mentioning Codex, Claude, or Gemini override the defaults.
- Keep work scoped to the task, verify before completion, and report changed files, evidence, and remaining risk.
- Two-step execution with a separate verifier is not enabled yet; consider it for high-risk complex tasks after the optional verifier-flow task is implemented.`;

function normalizeAgent(value?: string | null): SymphonyAgent | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "codex" || normalized === "claude" || normalized === "gemini") return normalized;
  return null;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function homePath(path: string) {
  return `"$HOME/${path.replace(/(["\\$`])/g, "\\$1")}"`;
}

function workspaceKey(task: SymphonyTask) {
  return task.id.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function getSymphonyWorkspacePath(task: SymphonyTask) {
  return `.symphony/workspaces/${workspaceKey(task)}`;
}

function resolveAgentCommand(options: SymphonyAgentOptions) {
  if (options.agentCommand?.trim()) return options.agentCommand.trim();
  return AGENT_COMMANDS[options.agent || "codex"] || AGENT_COMMANDS.codex;
}

function commandTemplateLabel(agent?: string, agentCommand?: string) {
  if (agentCommand?.trim()) return "custom";
  return agent || "codex";
}

function detectCostHint(agent?: string | null, template?: string | null) {
  const haystack = `${agent ?? ""} ${template ?? ""}`.toLowerCase();
  return HIGH_COST_AGENT_HINTS.some(hint => haystack.includes(hint))
    ? "high-cost profile requested - verify task explicitly needs it"
    : "cheap-default route";
}

export function chooseSymphonyAgent(
  task: SymphonyTask,
  memory?: string,
  additionalInstructions?: string,
): SymphonyRoute {
  const routingText = `${memory ?? ""}\n${additionalInstructions ?? ""}`.toLowerCase();
  const explicitAgent =
    normalizeAgent(routingText.match(/\b(?:use|route to|agent|model)\s*[:=]?\s*(codex|claude|gemini)\b/)?.[1]);

  if (explicitAgent) {
    return {
      agent: explicitAgent,
      label: AGENT_LABELS[explicitAgent],
      reason: "Explicit agent preference found in Symphony memory or custom instructions.",
    };
  }

  if (task.task_type === "research" || task.task_type === "docs") {
    return {
      agent: "gemini",
      label: AGENT_LABELS.gemini,
      reason: "Research/docs tasks default to Gemini for fast broad synthesis.",
    };
  }

  if (task.task_type === "bug" || task.priority === "high") {
    return {
      agent: "codex",
      label: AGENT_LABELS.codex,
      reason: "High-priority and bug-fix tasks default to Codex for code execution.",
    };
  }

  if (task.task_type === "cleanup" || task.task_type === "chore") {
    return {
      agent: "claude",
      label: AGENT_LABELS.claude,
      reason: "Cleanup/chore tasks default to Claude for careful editing and prose-heavy changes.",
    };
  }

  return {
    agent: "codex",
    label: AGENT_LABELS.codex,
    reason: "Default route when no stronger Symphony routing signal is present.",
  };
}

function renderAgentCommand(template: string, task: SymphonyTask, prompt: string, workspacePath: string) {
  const promptFile = `${workspacePath}/prompt.md`;
  return template
    .replaceAll("{prompt}", shellQuote(prompt))
    .replaceAll("{promptFile}", shellQuote(promptFile))
    .replaceAll("{workspace}", shellQuote(workspacePath))
    .replaceAll("{taskId}", shellQuote(task.id));
}

function formatMemoryBlock(memory?: string) {
  const trimmed = memory?.trim();
  if (!trimmed) return "";
  return `\nSymphony operating memory:\n${trimmed}\n`;
}

function formatAdditionalInstructions(additionalInstructions?: string) {
  const trimmed = additionalInstructions?.trim();
  if (!trimmed) return "";
  return `\nTask-specific instructions:\n${trimmed}\n`;
}

export function buildSymphonyPrompt(task: SymphonyTask, memory?: string, additionalInstructions?: string) {
  const project = task.project_slug ?? "saas-maker";

  return `You are running a Foundry Symphony task.

Task ID: ${task.id}
Title: ${task.title}
Project: ${project}
Priority: ${task.priority}
Type: ${task.task_type ?? "feature"}
Current status: ${task.status}
Branch: ${task.branch_name || "not linked"}
Pull request: ${task.pr_url || "not linked"} (${task.pr_status || "none"})
Commit: ${task.commit_sha || "not linked"}
Deployment: ${task.deployment_url || "not linked"} (${task.deployment_status || "none"})

Description:
${task.description?.trim() || "No additional description provided."}
${formatMemoryBlock(memory)}
${formatAdditionalInstructions(additionalInstructions)}

Execution contract:
- Treat the task row as the source of truth.
- Work in the project context above.
- Use this repository's AGENTS.md and WORKFLOW.md as operating guidance.
- Keep changes scoped to the task.
- Verify before claiming completion.
- When done, report changed files, evidence, and remaining risk so the task can be moved to Done.
`;
}

export function buildSymphonyCommand(task: SymphonyTask, options: SymphonyAgentOptions = {}) {
  return buildSymphonyRun(task, options).command;
}

export function buildSymphonyRun(task: SymphonyTask, options: SymphonyAgentOptions = {}): SymphonyRunSpec {
  const project = task.project_slug ?? "saas-maker";
  const workspacePath = getSymphonyWorkspacePath(task);
  const prompt = buildSymphonyPrompt(task, options.memory, options.additionalInstructions);
  const route = chooseSymphonyAgent(task, options.memory, options.additionalInstructions);
  const agentCommand = renderAgentCommand(resolveAgentCommand({ ...options, agent: options.agent ?? route.agent }), task, prompt, workspacePath);

  const command = [
    `cd ${homePath(`Desktop/Fleet/${project}`)}`,
    `mkdir -p ${shellQuote(workspacePath)}`,
    `printf %s ${shellQuote(prompt)} > ${shellQuote(`${workspacePath}/prompt.md`)}`,
    agentCommand,
  ].join(" && ");

  return {
    taskId: task.id,
    route,
    prompt,
    command,
  };
}

export function buildSymphonyBatchRuns(tasks: SymphonyTask[], options: SymphonyAgentOptions = {}) {
  return tasks.map(task => buildSymphonyRun(task, options));
}

export function buildSymphonyBatchPrompt(tasks: SymphonyTask[], options: SymphonyAgentOptions = {}) {
  return buildSymphonyBatchRuns(tasks, options)
    .map((run, index) => [
      `# Symphony batch item ${index + 1}: ${run.taskId}`,
      `Routed agent: ${run.route.label}`,
      `Routing reason: ${run.route.reason}`,
      "",
      run.prompt.trim(),
    ].join("\n"))
    .join("\n\n---\n\n");
}

export function buildSymphonyRunRecord(
  task: SymphonyTask,
  options: SymphonyAgentOptions & { pid?: number; terminalHint?: string; logHint?: string; tokenNote?: string } = {},
) {
  const route = chooseSymphonyAgent(task, options.memory, options.additionalInstructions);
  const agent = options.agent ?? route.agent;
  const commandTemplate = commandTemplateLabel(agent, options.agentCommand);
  const workspacePath = getSymphonyWorkspacePath(task);

  return {
    task_id: task.id,
    project_slug: task.project_slug,
    agent_profile: agent,
    model_profile: agent,
    command_template: commandTemplate,
    pid: typeof options.pid === "number" && Number.isFinite(options.pid) ? options.pid : null,
    status: "started",
    workspace_path: workspacePath,
    prompt_path: `${workspacePath}/prompt.md`,
    terminal_hint: options.terminalHint ?? "cockpit local run",
    log_hint: options.logHint ?? null,
    cost_note: detectCostHint(agent, options.agentCommand ?? commandTemplate),
    token_note: options.tokenNote ?? null,
    metadata: {
      route_label: route.label,
      route_reason: route.reason,
      priority: task.priority,
      task_type: task.task_type ?? "feature",
    },
  };
}
