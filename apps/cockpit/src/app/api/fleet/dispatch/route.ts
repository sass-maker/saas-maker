import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { activeProcesses } from "@/lib/process-registry";

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

    // 1. Create Job Entry in DB (Cloud)
    // We use the internal API fetch to hit the workers/api
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
    const foundryToken = process.env.SAASMAKER_API_KEY;

    // Fire and forget job creation
    fetch(`${apiBase}/v1/jobs`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${foundryToken}`,
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        id: jobId,
        project_id: projectId,
        type: "debug",
        status: "running",
        message: `Fixing: ${message}`
      })
    }).catch(e => console.error("Failed to record job", e));

    const prompt = `
[FOUNDRY INCIDENT DISPATCH]
Project: ${projectId}
Error: ${message}
Trace: ${stack || 'N/A'}

Your Mission: Follow saas-maker/skills/protocol-debugging.md to resolve this.
`;

    // 2. Dispatch Agent
    const child = spawn('gemini', ['--prompt', prompt], {
      cwd: projectPath,
      env: { ...process.env, FORCE_COLOR: 'true' }
    });

    activeProcesses.set(jobId, child);

    child.on('close', (code) => {
      // Update job status to completed/failed
      fetch(`${apiBase}/v1/jobs/${jobId}/logs`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${foundryToken}`,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          status: code === 0 ? "completed" : "failed",
          logs: `Terminated with code ${code}`
        })
      }).catch(() => {});
    });

    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    return NextResponse.json({ error: "Dispatch failed", detail: String(err) }, { status: 500 });
  }
}
