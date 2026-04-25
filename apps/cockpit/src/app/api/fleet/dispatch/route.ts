import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

/**
 * Registry of active agent processes for log streaming.
 * In a local factory environment, this global map is effective.
 */
export const activeProcesses = new Map<string, any>();

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId, message, stack } = await req.json();
    const jobId = crypto.randomUUID();

    const cockpitPath = process.cwd();
    const desktopPath = path.resolve(cockpitPath, '../..');
    const projectPath = path.join(desktopPath, 'Fleet', projectId);

    if (!fs.existsSync(projectPath)) {
      return NextResponse.json({ error: `Project path not found: ${projectPath}` }, { status: 404 });
    }

    const prompt = `
[FOUNDRY INCIDENT DISPATCH]
Project: ${projectId}
Error: ${message}
Trace: ${stack || 'N/A'}

Your Mission: Follow saas-maker/skills/protocol-debugging.md to resolve this.
`;

    // 1. Dispatch Agent
    const child = spawn('gemini', ['--prompt', prompt], {
      cwd: projectPath,
      env: { ...process.env, FORCE_COLOR: 'true' }
    });

    // 2. Store process in registry for SSE route to consume
    activeProcesses.set(jobId, child);

    // 3. Auto-cleanup after 10 mins
    setTimeout(() => {
      if (activeProcesses.has(jobId)) {
        child.kill();
        activeProcesses.delete(jobId);
      }
    }, 600000);

    console.log(`[Cockpit] Dispatched agent ${jobId} to ${projectId}`);

    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    return NextResponse.json({ error: "Dispatch failed", detail: String(err) }, { status: 500 });
  }
}
