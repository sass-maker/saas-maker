type SymphonyTask = {
  id: string;
  title: string;
  description: string | null;
  project_slug: string | null;
  priority: string;
  task_type?: string;
  size?: string;
  status: string;
};

type SymphonyAgentOptions = {
  agent?: string;
  agentCommand?: string;
  memory?: string;
  additionalInstructions?: string;
};

export type SymphonyAgent = "codex" | "claude" | "gemini";

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

function resolveAgentCommand(options: SymphonyAgentOptions) {
  if (options.agentCommand?.trim()) return options.agentCommand.trim();
  return AGENT_COMMANDS[options.agent || "codex"] || AGENT_COMMANDS.codex;
}

export function chooseSymphonyAgent(
  task: SymphonyTask,
  memory?: string,
  additionalInstructions?: string,
): { agent: SymphonyAgent; label: string; reason: string } {
  const routingText = `${memory ?? ""}\n${additionalInstructions ?? ""}`.toLowerCase();
  const explicitAgent =
    normalizeAgent(routingText.match(/\b(?:use|route to|agent|model)\s*[:=]?\s*(codex|claude|gemini)\b/)?.[1]) ??
    normalizeAgent(routingText.match(/\b(codex|claude|gemini)\b/)?.[1]);

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

  if (task.task_type === "bug" || task.size === "l" || task.size === "xl" || task.priority === "high") {
    return {
      agent: "codex",
      label: AGENT_LABELS.codex,
      reason: "High-priority, large, and bug-fix tasks default to Codex for code execution.",
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
Size: ${task.size ?? "m"}
Current status: ${task.status}

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
  const project = task.project_slug ?? "saas-maker";
  const workspacePath = `.symphony/workspaces/${workspaceKey(task)}`;
  const prompt = buildSymphonyPrompt(task, options.memory, options.additionalInstructions);
  const route = chooseSymphonyAgent(task, options.memory, options.additionalInstructions);
  const agentCommand = renderAgentCommand(resolveAgentCommand({ ...options, agent: options.agent ?? route.agent }), task, prompt, workspacePath);

  return [
    `cd ${homePath(`Desktop/Fleet/${project}`)}`,
    `mkdir -p ${shellQuote(workspacePath)}`,
    `printf %s ${shellQuote(prompt)} > ${shellQuote(`${workspacePath}/prompt.md`)}`,
    agentCommand,
  ].join(" && ");
}
