type SymphonyTask = {
  id: string;
  title: string;
  description: string | null;
  project_slug: string | null;
  priority: string;
  status: string;
};

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function homePath(path: string) {
  return `"$HOME/${path.replace(/(["\\$`])/g, "\\$1")}"`;
}

function workspaceKey(task: SymphonyTask) {
  return task.id.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function buildSymphonyPrompt(task: SymphonyTask) {
  const project = task.project_slug ?? "saas-maker";

  return `You are running a Foundry Symphony task.

Task ID: ${task.id}
Title: ${task.title}
Project: ${project}
Priority: ${task.priority}
Current status: ${task.status}

Description:
${task.description?.trim() || "No additional description provided."}

Execution contract:
- Treat the task row as the source of truth.
- Work in the project context above.
- Use this repository's AGENTS.md and WORKFLOW.md as operating guidance.
- Keep changes scoped to the task.
- Verify before claiming completion.
- When done, report changed files, evidence, and remaining risk so the task can be moved to Done.
`;
}

export function buildSymphonyCommand(task: SymphonyTask) {
  const project = task.project_slug ?? "saas-maker";
  const workspacePath = `.symphony/workspaces/${workspaceKey(task)}`;
  const prompt = buildSymphonyPrompt(task);

  return [
    `cd ${homePath(`Desktop/Fleet/${project}`)}`,
    `mkdir -p ${shellQuote(workspacePath)}`,
    `cd ${shellQuote(workspacePath)}`,
    `codex ${shellQuote(prompt)}`,
  ].join(" && ");
}
