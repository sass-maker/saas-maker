import { NextResponse } from "next/server";
import { headers } from "next/headers";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { apiFetchAuthed } from "@/lib/api-client";
import { buildSymphonyBatchRuns, buildSymphonyRunRecord, type SymphonyAgentUsageSnapshot } from "@/lib/symphony";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

type RunTask = Parameters<typeof buildSymphonyRunRecord>[0];

function repoRoot() {
  let current = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    if (fs.existsSync(path.join(current, "scripts", "symphony-agent-exec.mjs"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(process.cwd(), "../..");
}

async function startWithSidecar(command: string, taskId: string) {
  const runnerUrl = process.env.SYMPHONY_RUNNER_URL || "http://127.0.0.1:3011";
  const res = await fetch(`${runnerUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, taskId }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json() as Promise<{ ok: boolean; pid?: number }>;
}

function wrapCommand(command: string, taskId: string, agent: string, runId: string) {
  const scriptPath = path.join(repoRoot(), "scripts", "symphony-agent-exec.mjs");
  const encoded = Buffer.from(command, "utf8").toString("base64");
  return [
    JSON.stringify(process.execPath),
    JSON.stringify(scriptPath),
    "--task-id",
    JSON.stringify(taskId),
    "--agent",
    JSON.stringify(agent),
    "--run-id",
    JSON.stringify(runId),
    "--command-base64",
    JSON.stringify(encoded),
  ].join(" ");
}

function runLogHint(taskId: string, runId: string) {
  const safeTaskId = taskId.replace(/[^A-Za-z0-9._-]/g, "_");
  const safeRunId = runId.replace(/[^A-Za-z0-9._-]/g, "_");
  return `.symphony/runs/${safeTaskId}-${safeRunId}.log`;
}

function isBlockedTask(task: { blocked?: unknown }) {
  return task.blocked === true;
}

function readAgentUsage(): SymphonyAgentUsageSnapshot | null {
  try {
    const filePath = path.join(repoRoot(), ".symphony", "agent-usage.json");
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as SymphonyAgentUsageSnapshot;
  } catch {
    return null;
  }
}

async function recordRun(task: RunTask | undefined, options: {
  agent?: string;
  agentCommand?: string;
  memory?: string;
  additionalInstructions?: string;
  agentUsage?: SymphonyAgentUsageSnapshot | null;
  pid?: number;
  terminalHint: string;
  logHint?: string;
}) {
  if (!task) return;
  try {
    await apiFetchAuthed("/v1/symphony/runs", {
      method: "POST",
      body: JSON.stringify(buildSymphonyRunRecord(task, options)),
    });
  } catch (error) {
    if (process.env.SYMPHONY_AUDIT_DEBUG) {
      console.error("Failed to record Symphony run ledger entry", error);
    }
  }
}

export async function POST(req: Request) {
  const requestHeaders = await headers();
  if (!isLocalAuthBypassEnabled(requestHeaders.get("host"))) {
    return NextResponse.json({ error: "Task execution is only available locally" }, { status: 403 });
  }

  try {
    const { task, tasks, agent, agentCommand, memory, additionalInstructions } = await req.json();
    const runTasks = Array.isArray(tasks) ? tasks : task ? [task] : [];
    if (runTasks.length === 0 || runTasks.some(item => !item?.id || !item?.title)) {
      return NextResponse.json({ error: "Task payload is required" }, { status: 400 });
    }
    if (runTasks.some(item => item.status === "done" || isBlockedTask(item))) {
      return NextResponse.json({ error: "Blocked and done tasks cannot be dispatched" }, { status: 400 });
    }

    const agentUsage = readAgentUsage();
    const runs = buildSymphonyBatchRuns(runTasks, { agent, agentCommand, memory, additionalInstructions, agentUsage });
    const tasksById = new Map(runTasks.map(item => [item.id, item]));
    const started = [];
    try {
      const { spawn } = await import("node:child_process");
      for (const run of runs) {
        const runId = randomUUID();
        const command = wrapCommand(run.command, run.taskId, run.route.agent, runId);
        const child = spawn(command, {
          shell: true,
          cwd: repoRoot(),
          detached: true,
          stdio: "ignore",
          env: { ...process.env, FORCE_COLOR: "true" },
        });

        child.unref();
        await recordRun(tasksById.get(run.taskId), {
          agent: agent ?? run.route.agent,
          agentCommand,
          memory,
          additionalInstructions,
          agentUsage,
          pid: child.pid,
          terminalHint: "cockpit local run spawned detached child process",
          logHint: runLogHint(run.taskId, runId),
        });
        started.push({ taskId: run.taskId, pid: child.pid, route: run.route });
      }
      return NextResponse.json({ ok: true, pid: started[0]?.pid, route: started[0]?.route, runs: started });
    } catch {
      for (const run of runs) {
        const runId = randomUUID();
        const command = wrapCommand(run.command, run.taskId, run.route.agent, runId);
        const result = await startWithSidecar(command, run.taskId);
        await recordRun(tasksById.get(run.taskId), {
          agent: agent ?? run.route.agent,
          agentCommand,
          memory,
          additionalInstructions,
          agentUsage,
          pid: result.pid,
          terminalHint: "cockpit local run delegated to sidecar runner",
          logHint: runLogHint(run.taskId, runId),
        });
        started.push({ taskId: run.taskId, pid: result.pid, route: run.route });
      }
      return NextResponse.json({ ok: true, pid: started[0]?.pid, route: started[0]?.route, runs: started });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to start task agent", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
