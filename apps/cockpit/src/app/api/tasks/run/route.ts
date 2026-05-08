import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { apiFetchAuthed } from "@/lib/api-client";
import { buildSymphonyBatchRuns, buildSymphonyRunRecord } from "@/lib/symphony";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

type RunTask = Parameters<typeof buildSymphonyRunRecord>[0];

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

function isBlockedTask(task: { blocked?: unknown }) {
  return task.blocked === true;
}

async function recordRun(task: RunTask | undefined, options: {
  agent?: string;
  agentCommand?: string;
  memory?: string;
  additionalInstructions?: string;
  pid?: number;
  terminalHint: string;
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

    const runs = buildSymphonyBatchRuns(runTasks, { agent, agentCommand, memory, additionalInstructions });
    const tasksById = new Map(runTasks.map(item => [item.id, item]));
    const started = [];
    try {
      const { spawn } = await import("node:child_process");
      for (const run of runs) {
        const child = spawn(run.command, {
          shell: true,
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
          pid: child.pid,
          terminalHint: "cockpit local run spawned detached child process",
        });
        started.push({ taskId: run.taskId, pid: child.pid, route: run.route });
      }
      return NextResponse.json({ ok: true, pid: started[0]?.pid, route: started[0]?.route, runs: started });
    } catch {
      for (const run of runs) {
        const result = await startWithSidecar(run.command, run.taskId);
        await recordRun(tasksById.get(run.taskId), {
          agent: agent ?? run.route.agent,
          agentCommand,
          memory,
          additionalInstructions,
          pid: result.pid,
          terminalHint: "cockpit local run delegated to sidecar runner",
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
