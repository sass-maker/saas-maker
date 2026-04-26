import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activeProcesses } from "@/lib/process-registry";

export const dynamic = "force-dynamic";

/**
 * SSE Route: Streams live stdout/stderr from a dispatched agent job.
 */
export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const child = activeProcesses.get(jobId);

  if (!child) {
    return NextResponse.json({ error: "Job session not found or already terminated" }, { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: string) => {
        controller.enqueue(`data: ${msg}\n\n`);
      };

      child.stdout?.on("data", (chunk: any) => send(chunk.toString()));
      child.stderr?.on("data", (chunk: any) => send(`ERR: ${chunk.toString()}`));

      child.on("close", (code: number) => {
        send(`[SYSTEM] Factory Agent terminated with code ${code}`);
        activeProcesses.delete(jobId);
        controller.close();
      });
    },
    cancel() {
      child.kill();
      activeProcesses.delete(jobId);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
