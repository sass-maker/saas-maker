import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { buildSymphonyCommand } from "@/lib/symphony";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";

export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  const requestHeaders = await headers();
  if (!isLocalAuthBypassEnabled(requestHeaders.get("host"))) {
    return NextResponse.json({ error: "Task execution is only available locally" }, { status: 403 });
  }

  try {
    const { task, agent, agentCommand } = await req.json();
    if (!task?.id || !task?.title) {
      return NextResponse.json({ error: "Task payload is required" }, { status: 400 });
    }

    const command = buildSymphonyCommand(task, { agent, agentCommand });
    try {
      const { spawn } = await import("node:child_process");
      const child = spawn(command, {
        shell: true,
        detached: true,
        stdio: "ignore",
        env: { ...process.env, FORCE_COLOR: "true" },
      });

      child.unref();
      return NextResponse.json({ ok: true, pid: child.pid });
    } catch {
      const result = await startWithSidecar(command, task.id);
      return NextResponse.json(result);
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to start task agent", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
